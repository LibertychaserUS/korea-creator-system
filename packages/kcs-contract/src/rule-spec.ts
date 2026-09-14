/**
 * RuleSpec — the scoring rule as *data*.
 *
 * First principle: scoring is a customizable, versioned query specification.
 * Ops edit weights / keyword lists / thresholds in the rule workbench, publish a
 * new version, and the code only executes the spec. `scoreCreatorWith` is a pure
 * function of (input, spec); `DEFAULT_RULE_SPEC` reproduces the historical
 * rv-2026.09 constants byte-for-byte so locked scores stay reproducible.
 */
export const RULE_DIMENSION_IDS = [
  'screening',
  'keywords',
  'koreaBrand',
  'potential',
  'performance',
  'value',
] as const

export type DimensionId = (typeof RULE_DIMENSION_IDS)[number]

export const RULE_GRADES = ['S', 'A', 'B', 'C'] as const

export type RuleGrade = (typeof RULE_GRADES)[number]

export type RuleWeight = { id: DimensionId; weight: number }
export type RuleGradeThreshold = { grade: RuleGrade; min: number }
export type RuleTier = { min: number; raw: number }
export type RuleCpmTier = { max: number; raw: number }

export type RuleRiskId = 'personaMissing' | 'tagsMissing' | 'lowEr' | 'highQuote' | 'excluded'

export type RuleSpec = {
  /** Immutable once published, e.g. `rv-2026.09` / `rv-2026.10-2`. */
  version: string
  /** Free-form label shown to ops, e.g. "Q4 韩系美妆偏重". */
  name: string
  /** Weights sum to 100. */
  weights: RuleWeight[]
  /** Descending by `min`; last row must be grade C with min 0. */
  grades: RuleGradeThreshold[]
  keywords: {
    content: string[]
    korea: string[]
    brand: string[]
    exclude: string[]
  }
  /** Follower tiers for the screening dimension, descending by `min`. */
  followerTiers: RuleTier[]
  /** CPM tiers (quote / followers × 1000) for the value dimension, ascending by `max`. */
  cpmTiers: RuleCpmTier[]
  /** Raw value score when quote or followers are missing. */
  valueFallbackRaw: number
  /** Risk deductions are negative numbers; `cap` is the floor of the total (e.g. -10). */
  risk: Record<RuleRiskId, number> & { cap: number }
}

export type RuleSpecRecord = {
  spec: RuleSpec
  isCurrent: boolean
  publishedAt: string
  publishedBy: string | null
  note: string | null
}

export const DEFAULT_RULE_SPEC: RuleSpec = {
  version: 'rv-2026.09',
  name: '默认规则',
  weights: [
    { id: 'screening', weight: 25 },
    { id: 'keywords', weight: 15 },
    { id: 'koreaBrand', weight: 25 },
    { id: 'potential', weight: 20 },
    { id: 'performance', weight: 10 },
    { id: 'value', weight: 5 },
  ],
  grades: [
    { grade: 'S', min: 85 },
    { grade: 'A', min: 75 },
    { grade: 'B', min: 65 },
    { grade: 'C', min: 0 },
  ],
  keywords: {
    content: ['时尚', '穿搭', '美妆', 'vlog', '生活方式', '开箱', '旅行', '探店', '护肤', '空瓶'],
    korea: ['韩国', '韩', '首尔', '서울', '济州', '釜山', '圣水', '明洞', '올리브영'],
    brand: ['雪花秀', '설화수', '兰芝', '라네즈', '홀리추얼', 'emis', 'rockfish'],
    exclude: ['纯KPOP追星', '纯美食探店', '纯旅游攻略'],
  },
  followerTiers: [
    { min: 1_000_000, raw: 100 },
    { min: 300_000, raw: 90 },
    { min: 150_000, raw: 80 },
    { min: 100_000, raw: 65 },
    { min: 50_000, raw: 50 },
    { min: 1, raw: 40 },
    { min: 0, raw: 20 },
  ],
  cpmTiers: [
    { max: 40, raw: 95 },
    { max: 80, raw: 80 },
    { max: 150, raw: 60 },
    { max: Number.POSITIVE_INFINITY, raw: 35 },
  ],
  valueFallbackRaw: 30,
  risk: {
    personaMissing: -2,
    tagsMissing: -2,
    lowEr: -2,
    highQuote: -2,
    excluded: -3,
    cap: -10,
  },
}

export const RULE_RISK_IDS: readonly RuleRiskId[] = [
  'personaMissing',
  'tagsMissing',
  'lowEr',
  'highQuote',
  'excluded',
]

export function weightOf(spec: RuleSpec, id: DimensionId): number {
  return spec.weights.find((w) => w.id === id)?.weight ?? 0
}

export function gradeForWith(final: number, spec: RuleSpec): RuleGrade {
  for (const row of spec.grades) {
    if (final >= row.min) return row.grade
  }
  return 'C'
}

/**
 * Structural validation used by both the API (before persisting) and the rule
 * workbench (inline, before enabling "publish"). Returns i18n-neutral error
 * codes so the UI can localize them.
 */
export function validateRuleSpec(spec: unknown): string[] {
  const errors: string[] = []
  if (!spec || typeof spec !== 'object') return ['spec.invalid']
  const s = spec as Partial<RuleSpec>

  if (typeof s.version !== 'string' || !/^rv-\d{4}\.\d{2}(-\d+)?$/.test(s.version)) errors.push('version.format')
  if (typeof s.name !== 'string' || !s.name.trim()) errors.push('name.required')

  if (!Array.isArray(s.weights)) errors.push('weights.missing')
  else {
    const ids = new Set(s.weights.map((w) => w?.id))
    for (const id of RULE_DIMENSION_IDS) if (!ids.has(id)) errors.push(`weights.missing.${id}`)
    if (s.weights.some((w) => typeof w?.weight !== 'number' || w.weight < 0 || w.weight > 100)) errors.push('weights.range')
    const sum = s.weights.reduce((acc, w) => acc + (Number(w?.weight) || 0), 0)
    if (Math.abs(sum - 100) > 0.001) errors.push('weights.sum')
  }

  if (!Array.isArray(s.grades) || s.grades.length !== RULE_GRADES.length) errors.push('grades.shape')
  else {
    const order = s.grades.map((g) => g?.grade)
    if (order.join(',') !== RULE_GRADES.join(',')) errors.push('grades.order')
    if (s.grades.some((g) => typeof g?.min !== 'number' || g.min < 0 || g.min > 100)) errors.push('grades.range')
    for (let i = 1; i < s.grades.length; i++) {
      if (Number(s.grades[i]!.min) >= Number(s.grades[i - 1]!.min)) errors.push('grades.descending')
    }
    if (Number(s.grades[s.grades.length - 1]?.min) !== 0) errors.push('grades.floor')
  }

  const kw = s.keywords
  if (!kw || typeof kw !== 'object') errors.push('keywords.missing')
  else {
    for (const key of ['content', 'korea', 'brand', 'exclude'] as const) {
      const list = (kw as Record<string, unknown>)[key]
      if (!Array.isArray(list) || list.some((w) => typeof w !== 'string' || !w.trim())) errors.push(`keywords.${key}`)
    }
  }

  if (!Array.isArray(s.followerTiers) || !s.followerTiers.length) errors.push('followerTiers.missing')
  else {
    for (let i = 1; i < s.followerTiers.length; i++) {
      if (Number(s.followerTiers[i]!.min) >= Number(s.followerTiers[i - 1]!.min)) errors.push('followerTiers.descending')
    }
    if (Number(s.followerTiers[s.followerTiers.length - 1]?.min) !== 0) errors.push('followerTiers.floor')
  }

  if (!Array.isArray(s.cpmTiers) || !s.cpmTiers.length) errors.push('cpmTiers.missing')
  else {
    for (let i = 1; i < s.cpmTiers.length; i++) {
      if (Number(s.cpmTiers[i]!.max) <= Number(s.cpmTiers[i - 1]!.max)) errors.push('cpmTiers.ascending')
    }
    if (Number(s.cpmTiers[s.cpmTiers.length - 1]?.max) !== Number.POSITIVE_INFINITY) errors.push('cpmTiers.ceiling')
  }

  if (typeof s.valueFallbackRaw !== 'number' || s.valueFallbackRaw < 0 || s.valueFallbackRaw > 100) errors.push('valueFallbackRaw.range')

  if (!s.risk || typeof s.risk !== 'object') errors.push('risk.missing')
  else {
    for (const id of [...RULE_RISK_IDS, 'cap'] as const) {
      const v = (s.risk as Record<string, unknown>)[id]
      if (typeof v !== 'number' || v > 0 || v < -100) errors.push(`risk.${id}`)
    }
  }

  return [...new Set(errors)]
}

/** JSON has no Infinity; serialize the open-ended cpm ceiling as null. */
export function serializeRuleSpec(spec: RuleSpec): string {
  return JSON.stringify(spec, (_key, value) => (value === Number.POSITIVE_INFINITY ? null : value))
}

export function parseRuleSpec(json: string | Record<string, unknown>): RuleSpec {
  const raw = typeof json === 'string' ? (JSON.parse(json) as Record<string, unknown>) : json
  const cpm = Array.isArray(raw.cpmTiers) ? (raw.cpmTiers as RuleCpmTier[]) : []
  return {
    ...(raw as unknown as RuleSpec),
    cpmTiers: cpm.map((t) => ({ ...t, max: t.max == null ? Number.POSITIVE_INFINITY : Number(t.max) })),
  }
}

export function nextRuleVersion(existing: readonly string[], now = new Date()): string {
  const ym = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const base = `rv-${ym}`
  if (!existing.includes(base)) return base
  let n = 2
  while (existing.includes(`${base}-${n}`)) n++
  return `${base}-${n}`
}
