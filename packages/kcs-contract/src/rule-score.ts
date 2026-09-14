/**
 * Rule scoring = pure function of (input, spec).
 * The legacy constants below are derived from DEFAULT_RULE_SPEC so existing
 * callers / tests keep working; new code should pass an explicit spec.
 */
import {
  DEFAULT_RULE_SPEC,
  gradeForWith,
  weightOf,
  type DimensionId,
  type RuleGrade,
  type RuleSpec,
} from './rule-spec'

export type { DimensionId, RuleGrade } from './rule-spec'

export const RULE_VERSION = DEFAULT_RULE_SPEC.version

export const RULE_DIMENSIONS = DEFAULT_RULE_SPEC.weights.map((w) => ({
  id: w.id,
  weight: w.weight,
  labelKey: `score.${w.id}`,
}))

export const GRADE_THRESHOLDS = DEFAULT_RULE_SPEC.grades

export const CONTENT_KEYWORDS = DEFAULT_RULE_SPEC.keywords.content
export const KOREA_KEYWORDS = DEFAULT_RULE_SPEC.keywords.korea
export const BRAND_KEYWORDS = DEFAULT_RULE_SPEC.keywords.brand
export const EXCLUDE_KEYWORDS = DEFAULT_RULE_SPEC.keywords.exclude

export type ScoreInput = {
  followers?: number | null
  keywords?: string[]
  region?: string
  persona?: string
  contentTags?: string[]
  price?: number | null
  hasCollaborated?: boolean
  collabMedian?: number
  readMedian?: number
  interactMedian?: number
  collabEr?: number
  dailyEr?: number
  noteCount?: number
}

export type DimensionScore = {
  id: DimensionId
  weight: number
  raw: number
  contribution: number
}

export type RuleScore = {
  ruleVersion: string
  dimensions: DimensionScore[]
  riskDeduction: number
  riskReasons: string[]
  hits: string[]
  final: number
  grade: RuleGrade
  formula: string
}

function clip(n: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, n))
}

function round1(n: number): number {
  return Number(n.toFixed(1))
}

function blob(input: ScoreInput): string {
  return [
    input.region,
    input.persona,
    ...(input.contentTags || []),
    ...(input.keywords || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function hitsIn(text: string, dict: readonly string[]): string[] {
  return dict.filter((word) => text.includes(word.toLowerCase()))
}

function tierRaw(followers: number | null | undefined, spec: RuleSpec): number {
  const n = followers ?? 0
  for (const tier of spec.followerTiers) {
    if (n >= tier.min) return tier.raw
  }
  return spec.followerTiers[spec.followerTiers.length - 1]?.raw ?? 0
}

function cpmRaw(cpm: number, spec: RuleSpec): number {
  for (const tier of spec.cpmTiers) {
    if (cpm < tier.max) return tier.raw
  }
  return spec.cpmTiers[spec.cpmTiers.length - 1]?.raw ?? 0
}

function contribute(raw: number, weight: number): number {
  return round1((clip(raw) * weight) / 100)
}

export function gradeFor(final: number, spec: RuleSpec = DEFAULT_RULE_SPEC): RuleGrade {
  return gradeForWith(final, spec)
}

export const RISK_REASON_LABELS = {
  personaMissing: '身份画像缺失',
  tagsMissing: '内容标签缺失',
  lowEr: '合作ER过低',
  highQuote: '报价偏高',
  excluded: '排除类型匹配',
} as const

export function scoreCreatorWith(input: ScoreInput, spec: RuleSpec): RuleScore {
  const text = blob(input)
  const contentHits = hitsIn(text, spec.keywords.content)
  const koreaHits = hitsIn(text, spec.keywords.korea)
  const brandHits = hitsIn(text, spec.keywords.brand)
  const excludeHits = hitsIn(text, spec.keywords.exclude)

  const keywordRaw = clip(contentHits.length * 30)

  let koreaRaw = 0
  if (koreaHits.length) koreaRaw += 40
  koreaRaw += Math.min(30, koreaHits.length * 10)
  koreaRaw += Math.min(30, brandHits.length * 12)
  if (koreaRaw === 0) koreaRaw = 10

  const fanRaw = tierRaw(input.followers, spec)
  const collabRaw = input.hasCollaborated ? 80 : 45
  const notesRaw = clip((input.noteCount ?? 0) * 8)
  const potentialRaw = fanRaw * 0.4 + collabRaw * 0.35 + notesRaw * 0.25

  const er = input.collabEr ?? input.dailyEr
  const read = input.readMedian ?? 0
  const interact = input.interactMedian ?? input.collabMedian ?? 0
  let performanceRaw = 55
  if (er != null) performanceRaw = clip(er * 1600)
  if (read) performanceRaw = (performanceRaw + clip(read / 2000)) / 2
  if (interact) performanceRaw = (performanceRaw + clip(interact / 150)) / 2

  const followers = input.followers ?? 0
  const price = input.price ?? null
  const highQuoteCpm = spec.cpmTiers.length >= 2 ? spec.cpmTiers[spec.cpmTiers.length - 2]!.max : Number.POSITIVE_INFINITY
  let valueRaw = spec.valueFallbackRaw
  if (price != null && followers > 0) {
    valueRaw = cpmRaw((price / followers) * 1000, spec)
  }

  const raws: Record<DimensionId, number> = {
    screening: fanRaw,
    keywords: keywordRaw,
    koreaBrand: koreaRaw,
    potential: potentialRaw,
    performance: performanceRaw,
    value: valueRaw,
  }
  const dimensions: DimensionScore[] = spec.weights.map((w) => ({
    id: w.id,
    weight: w.weight,
    raw: raws[w.id],
    contribution: contribute(raws[w.id], weightOf(spec, w.id)),
  }))

  const riskReasons: string[] = []
  let risk = 0
  if (!input.persona) {
    risk += spec.risk.personaMissing
    riskReasons.push(RISK_REASON_LABELS.personaMissing)
  }
  if (!input.contentTags?.length) {
    risk += spec.risk.tagsMissing
    riskReasons.push(RISK_REASON_LABELS.tagsMissing)
  }
  if (er != null && er < 0.01) {
    risk += spec.risk.lowEr
    riskReasons.push(RISK_REASON_LABELS.lowEr)
  }
  if (price != null && followers > 0 && (price / followers) * 1000 > highQuoteCpm) {
    risk += spec.risk.highQuote
    riskReasons.push(RISK_REASON_LABELS.highQuote)
  }
  if (excludeHits.length) {
    risk += spec.risk.excluded
    riskReasons.push(RISK_REASON_LABELS.excluded)
  }
  if (risk < spec.risk.cap) risk = spec.risk.cap
  const riskDeduction = round1(risk)

  const sum = dimensions.reduce((acc, d) => acc + d.contribution, 0)
  const final = round1(clip(sum + riskDeduction, 0, 100))
  const parts = dimensions.map((d) => String(d.contribution)).join(' + ')
  const formula = `${parts} ${riskDeduction} = ${final}`

  return {
    ruleVersion: spec.version,
    dimensions,
    riskDeduction,
    riskReasons,
    hits: [...new Set([...contentHits, ...koreaHits, ...brandHits])],
    final,
    grade: gradeForWith(final, spec),
    formula,
  }
}

export function scoreCreator(input: ScoreInput, spec: RuleSpec = DEFAULT_RULE_SPEC): RuleScore {
  return scoreCreatorWith(input, spec)
}

export function creatorToScoreInput(row: {
  followers?: number | null
  regions?: string[] | null
  verticals?: string[] | null
  categories?: string[] | null
  displayName?: string | null
  note?: string | null
  hasCollaborated?: boolean
  price?: { amountMin?: number | null } | null
}): ScoreInput {
  const region = (row.regions || []).join(' ')
  const tags = [...(row.verticals || []), ...(row.categories || [])]
  return {
    followers: row.followers,
    region,
    persona: row.note || undefined,
    contentTags: tags,
    keywords: [row.displayName || '', region, ...tags].filter(Boolean),
    price: row.price?.amountMin ?? null,
    hasCollaborated: Boolean(row.hasCollaborated),
  }
}
