/**
 * SavedQuery — what used to be "scoring". A saved, versioned set of
 * filters + sort + highlight thresholds over CreatorMetrics. No weights,
 * no composite score: ops express what they want in platform terms
 * (CPE ≤ 3, health = healthy, 收藏/点赞 ≥ 0.8, tier = mid …).
 */
import {
  cohortPercentiles,
  deriveMetrics,
  normalizeHealth,
  RENAMED_METRIC_KEYS,
  SERVICE_FEE_RATES,
  tierOf,
  type ServiceFeeRate,
  type CreatorMetrics,
  type CreatorTier,
  type HealthGrade,
  type MetricPercentiles,
  type NumericMetricKey,
  HEALTH_GRADES,
  METRIC_KEYS,
} from './metrics'
import type { SourceId } from './source-adapter'

export type MetricFilter =
  | { key: NumericMetricKey; op: 'gte' | 'lte'; value: number }
  | { key: NumericMetricKey; op: 'between'; value: [number, number] }
  | { key: NumericMetricKey; op: 'percentileGte'; value: number }

export type HighlightTone = 'good' | 'warn' | 'bad'

export type Highlight = {
  key: NumericMetricKey
  op: 'gte' | 'lte'
  value: number
  tone: HighlightTone
}

export type SavedQuery = {
  id: string
  name: string
  version: number
  sources: SourceId[]
  tiers: CreatorTier[]
  health: HealthGrade[]
  regions: string[]
  brandsAny: string[]
  filters: MetricFilter[]
  sort: { key: NumericMetricKey | 'followers'; dir: 'asc' | 'desc' }
  highlights: Highlight[]
  /** Columns the pool table shows for this query, in order. */
  columns: NumericMetricKey[]
  /** Cost fields shown (and filtered) with this service fee added: 0, 10% or 20% (优效). */
  serviceFee: ServiceFeeRate
}

export type QueryRow = {
  id: string
  creatorKey: string
  displayName: string
  source: SourceId
  regions: string[]
  coopBrands: string[]
  metrics: CreatorMetrics
}

/**
 * Percentiles are only comparable inside one data source (蒲公英 / 千瓜 / 新红
 * measure "阅读中位数" differently) and one follower tier. The cohort a row
 * was ranked against is returned so the UI can say "同源同量级 N 人".
 */
export type PercentileCohort = {
  source: SourceId
  tier: CreatorTier
  size: number
}

export type QueryResultRow<T extends QueryRow = QueryRow> = T & {
  tier: CreatorTier
  cohort: PercentileCohort
  percentiles: MetricPercentiles
  flags: { key: NumericMetricKey; tone: HighlightTone }[]
}

export function cohortKey(source: SourceId, tier: CreatorTier): string {
  return `${source}:${tier}`
}

export const DEFAULT_QUERY_COLUMNS: NumericMetricKey[] = [
  'followers',
  'readMedian',
  'interactionMedian',
  'engagementRate',
  'cpe',
  'collectLikeRatio',
  'readToFollowerRatio',
  'viralRate',
]

export function defaultSavedQuery(overrides: Partial<SavedQuery> = {}): SavedQuery {
  return {
    id: '',
    name: '',
    version: 1,
    sources: [],
    tiers: [],
    health: [],
    regions: [],
    brandsAny: [],
    filters: [],
    sort: { key: 'cpe', dir: 'asc' },
    highlights: [
      { key: 'cpe', op: 'lte', value: 3, tone: 'good' },
      { key: 'collectLikeRatio', op: 'gte', value: 0.8, tone: 'good' },
      { key: 'engagementRate', op: 'lte', value: 0.02, tone: 'warn' },
    ],
    columns: [...DEFAULT_QUERY_COLUMNS],
    serviceFee: 0,
    ...overrides,
  }
}

function renamedKey<T>(key: T): T {
  return (typeof key === 'string' && RENAMED_METRIC_KEYS[key] ? RENAMED_METRIC_KEYS[key] : key) as T
}

/**
 * A stored or posted spec in today's vocabulary: renamed metric keys
 * (`cpv` → `cpr` …) and the old three health grades (优秀 / 正常 → 健康).
 * Unknown values are left for `validateSavedQuery` to reject.
 */
export function normalizeSavedQuery(value: unknown): Partial<SavedQuery> {
  if (!value || typeof value !== 'object') return {}
  const q = { ...(value as Record<string, any>) }
  if (Array.isArray(q.columns)) q.columns = [...new Set(q.columns.map(renamedKey))]
  if (Array.isArray(q.filters)) q.filters = q.filters.map((f: any) => (f && typeof f === 'object' ? { ...f, key: renamedKey(f.key) } : f))
  if (Array.isArray(q.highlights)) q.highlights = q.highlights.map((h: any) => (h && typeof h === 'object' ? { ...h, key: renamedKey(h.key) } : h))
  if (q.sort && typeof q.sort === 'object') q.sort = { ...q.sort, key: renamedKey(q.sort.key) }
  if (Array.isArray(q.health)) {
    q.health = [...new Set(q.health.map((h: unknown) => normalizeHealth(h, null, null).health ?? h))]
  }
  if (q.serviceFee !== undefined && !SERVICE_FEE_RATES.includes(q.serviceFee)) q.serviceFee = 0
  return q as Partial<SavedQuery>
}

export function validateSavedQuery(q: unknown): string[] {
  const errors: string[] = []
  if (!q || typeof q !== 'object') return ['query.invalid']
  const s = q as Partial<SavedQuery>
  if (typeof s.name !== 'string' || !s.name.trim()) errors.push('name.required')
  if (!Array.isArray(s.filters)) errors.push('filters.shape')
  else {
    for (const f of s.filters) {
      if (!f || !METRIC_KEYS.includes(f.key)) errors.push('filters.key')
      else if (f.op === 'between') {
        if (!Array.isArray(f.value) || f.value.length !== 2 || f.value[0] > f.value[1]) errors.push('filters.between')
      } else if (typeof f.value !== 'number' || !Number.isFinite(f.value)) errors.push('filters.value')
      else if (f.op === 'percentileGte' && (f.value < 0 || f.value > 100)) errors.push('filters.percentile')
    }
  }
  if (!s.sort || (s.sort.key !== 'followers' && !METRIC_KEYS.includes(s.sort.key as NumericMetricKey))) errors.push('sort.key')
  if (!Array.isArray(s.columns) || !s.columns.length || s.columns.some((c) => !METRIC_KEYS.includes(c))) errors.push('columns')
  if (!Array.isArray(s.highlights) || s.highlights.some((h) => !h || !METRIC_KEYS.includes(h.key) || typeof h.value !== 'number')) errors.push('highlights')
  if (s.serviceFee !== undefined && !SERVICE_FEE_RATES.includes(s.serviceFee as ServiceFeeRate)) errors.push('serviceFee')
  if (Array.isArray(s.health) && s.health.some((h) => !HEALTH_GRADES.includes(h as (typeof HEALTH_GRADES)[number]))) errors.push('health')
  return [...new Set(errors)]
}

function passes(row: QueryResultRow, f: MetricFilter): boolean {
  if (f.op === 'percentileGte') {
    const p = row.percentiles[f.key]
    return p != null && p.percentile >= f.value
  }
  const v = row.metrics[f.key]
  if (v == null) return false
  if (f.op === 'between') return v >= f.value[0] && v <= f.value[1]
  return f.op === 'gte' ? v >= f.value : v <= f.value
}

/**
 * Pure evaluation: derive ratios, compute percentiles against the whole
 * input grouped by source × tier (so percentile filters see the full
 * cohort), then filter, flag, sort.
 */
export function applySavedQuery<T extends QueryRow>(rows: readonly T[], q: SavedQuery): QueryResultRow<T>[] {
  const derived = rows.map((r) => ({ ...r, metrics: deriveMetrics(r.metrics), tier: tierOf(r.metrics.followers) }))
  const byCohort = new Map<string, CreatorMetrics[]>()
  for (const r of derived) {
    const key = cohortKey(r.source, r.tier)
    const list = byCohort.get(key) ?? []
    list.push(r.metrics)
    byCohort.set(key, list)
  }
  const keys = [...new Set([...q.columns, ...q.filters.map((f) => f.key), ...q.highlights.map((h) => h.key)])]
  let out: QueryResultRow<T>[] = derived.map((r) => ({
    ...(r as T),
    tier: r.tier,
    cohort: { source: r.source, tier: r.tier, size: byCohort.get(cohortKey(r.source, r.tier))?.length ?? 0 },
    percentiles: cohortPercentiles(r.metrics, byCohort.get(cohortKey(r.source, r.tier)) ?? [], keys),
    flags: q.highlights
      .filter((h) => {
        const v = r.metrics[h.key]
        return v != null && (h.op === 'gte' ? v >= h.value : v <= h.value)
      })
      .map((h) => ({ key: h.key, tone: h.tone })),
  }))

  if (q.sources.length) out = out.filter((r) => q.sources.includes(r.source))
  if (q.tiers.length) out = out.filter((r) => q.tiers.includes(r.tier))
  if (q.health.length) out = out.filter((r) => r.metrics.health != null && q.health.includes(r.metrics.health))
  if (q.regions.length) out = out.filter((r) => r.regions.some((x) => q.regions.includes(x)))
  if (q.brandsAny.length) out = out.filter((r) => r.coopBrands.some((b) => q.brandsAny.includes(b)))
  for (const f of q.filters) out = out.filter((r) => passes(r, f))

  const dir = q.sort.dir === 'asc' ? 1 : -1
  out.sort((a, b) => {
    const av = a.metrics[q.sort.key]
    const bv = b.metrics[q.sort.key]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return (av - bv) * dir
  })
  return out
}
