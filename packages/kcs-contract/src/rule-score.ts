export const RULE_VERSION = 'rv-2026.09'

export const RULE_DIMENSIONS = [
  { id: 'screening', weight: 25, labelKey: 'score.screening' },
  { id: 'keywords', weight: 15, labelKey: 'score.keywords' },
  { id: 'koreaBrand', weight: 25, labelKey: 'score.koreaBrand' },
  { id: 'potential', weight: 20, labelKey: 'score.potential' },
  { id: 'performance', weight: 10, labelKey: 'score.performance' },
  { id: 'value', weight: 5, labelKey: 'score.value' },
] as const

export type DimensionId = (typeof RULE_DIMENSIONS)[number]['id']

export const GRADE_THRESHOLDS = [
  { grade: 'S' as const, min: 85 },
  { grade: 'A' as const, min: 75 },
  { grade: 'B' as const, min: 65 },
  { grade: 'C' as const, min: 0 },
]

export type RuleGrade = (typeof GRADE_THRESHOLDS)[number]['grade']

export const CONTENT_KEYWORDS = [
  '时尚',
  '穿搭',
  '美妆',
  'vlog',
  '生活方式',
  '开箱',
  '旅行',
  '探店',
  '护肤',
  '空瓶',
] as const

export const KOREA_KEYWORDS = [
  '韩国',
  '韩',
  '首尔',
  '서울',
  '济州',
  '釜山',
  '圣水',
  '明洞',
  '올리브영',
] as const

export const BRAND_KEYWORDS = ['雪花秀', '설화수', '兰芝', '兰芝', '홀리추얼', 'emis', 'rockfish'] as const

export const EXCLUDE_KEYWORDS = ['纯KPOP追星', '纯美食探店', '纯旅游攻略'] as const

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

function screeningRaw(followers?: number | null): number {
  const n = followers ?? 0
  if (n >= 1_000_000) return 100
  if (n >= 300_000) return 90
  if (n >= 150_000) return 80
  if (n >= 100_000) return 65
  if (n >= 50_000) return 50
  if (n > 0) return 40
  return 20
}

function contribute(raw: number, weight: number): number {
  return round1((clip(raw) * weight) / 100)
}

export function gradeFor(final: number): RuleGrade {
  for (const row of GRADE_THRESHOLDS) {
    if (final >= row.min) return row.grade
  }
  return 'C'
}

export function scoreCreator(input: ScoreInput): RuleScore {
  const text = blob(input)
  const contentHits = hitsIn(text, CONTENT_KEYWORDS)
  const koreaHits = hitsIn(text, KOREA_KEYWORDS)
  const brandHits = hitsIn(text, BRAND_KEYWORDS)
  const excludeHits = hitsIn(text, EXCLUDE_KEYWORDS)

  const keywordRaw = clip(contentHits.length * 30)

  let koreaRaw = 0
  if (koreaHits.length) koreaRaw += 40
  koreaRaw += Math.min(30, koreaHits.length * 10)
  koreaRaw += Math.min(30, brandHits.length * 12)
  if (koreaRaw === 0) koreaRaw = 10

  const fanRaw = screeningRaw(input.followers)
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
  let valueRaw = 30
  if (price != null && followers > 0) {
    const cpm = (price / followers) * 1000
    if (cpm < 40) valueRaw = 95
    else if (cpm < 80) valueRaw = 80
    else if (cpm < 150) valueRaw = 60
    else valueRaw = 35
  }

  const dimensions: DimensionScore[] = [
    { id: 'screening', weight: 25, raw: fanRaw, contribution: contribute(fanRaw, 25) },
    { id: 'keywords', weight: 15, raw: keywordRaw, contribution: contribute(keywordRaw, 15) },
    { id: 'koreaBrand', weight: 25, raw: koreaRaw, contribution: contribute(koreaRaw, 25) },
    { id: 'potential', weight: 20, raw: potentialRaw, contribution: contribute(potentialRaw, 20) },
    { id: 'performance', weight: 10, raw: performanceRaw, contribution: contribute(performanceRaw, 10) },
    { id: 'value', weight: 5, raw: valueRaw, contribution: contribute(valueRaw, 5) },
  ]

  const riskReasons: string[] = []
  let risk = 0
  if (!input.persona) {
    risk -= 2
    riskReasons.push('身份画像缺失')
  }
  if (!input.contentTags?.length) {
    risk -= 2
    riskReasons.push('内容标签缺失')
  }
  if (er != null && er < 0.01) {
    risk -= 2
    riskReasons.push('合作ER过低')
  }
  if (price != null && followers > 0 && (price / followers) * 1000 > 150) {
    risk -= 2
    riskReasons.push('报价偏高')
  }
  if (excludeHits.length) {
    risk -= 3
    riskReasons.push('排除类型匹配')
  }
  if (risk < -10) risk = -10
  const riskDeduction = round1(risk)

  const sum = dimensions.reduce((acc, d) => acc + d.contribution, 0)
  const final = round1(clip(sum + riskDeduction, 0, 100))
  const parts = dimensions.map((d) => String(d.contribution)).join(' + ')
  const formula = `${parts} ${riskDeduction} = ${final}`

  return {
    ruleVersion: RULE_VERSION,
    dimensions,
    riskDeduction,
    riskReasons,
    hits: [...new Set([...contentHits, ...koreaHits, ...brandHits])],
    final,
    grade: gradeFor(final),
    formula,
  }
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
