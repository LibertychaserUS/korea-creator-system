/**
 * SavedQuery — what used to be "scoring". A saved, versioned set of
 * filters + sort + highlight thresholds over CreatorMetrics. No weights,
 * no composite score: ops express what they want in platform terms
 * (CPE ≤ 3, health = excellent, 收藏/点赞 ≥ 0.8, tier = mid …).
 */
import {
  cohortPercentiles,
  deriveMetrics,
  tierOf,
  type CreatorMetrics,
  type CreatorTier,
  type HealthGrade,
  type MetricPercentiles,
  type NumericMetricKey,
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

export type QueryResultRow<T extends QueryRow = QueryRow> = T & {
  tier: CreatorTier
  percentiles: MetricPercentiles
  flags: { key: NumericMetricKey; tone: HighlightTone }[]
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
    health: ['excellent'],
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
    ...overrides,
  }
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
 * Pure evaluation: derive ratios, compute tier percentiles against the whole
 * input (so percentile filters see the full cohort), then filter, flag, sort.
 */
export function applySavedQuery<T extends QueryRow>(rows: readonly T[], q: SavedQuery): QueryResultRow<T>[] {
  const derived = rows.map((r) => ({ ...r, metrics: deriveMetrics(r.metrics), tier: tierOf(r.metrics.followers) }))
  const byTier = new Map<CreatorTier, CreatorMetrics[]>()
  for (const r of derived) {
    const list = byTier.get(r.tier) ?? []
    list.push(r.metrics)
    byTier.set(r.tier, list)
  }
  const keys = [...new Set([...q.columns, ...q.filters.map((f) => f.key), ...q.highlights.map((h) => h.key)])]
  let out: QueryResultRow<T>[] = derived.map((r) => ({
    ...(r as T),
    tier: r.tier,
    percentiles: cohortPercentiles(r.metrics, byTier.get(r.tier) ?? [], keys),
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
