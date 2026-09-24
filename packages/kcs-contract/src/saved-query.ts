/**
 * SavedQuery — what used to be "scoring". A saved, versioned set of
 * filters + sort + highlight thresholds over CreatorMetrics. No weights,
 * no composite score: ops express what they want in platform terms
 * (CPE ≤ 3, health = healthy, 收藏/点赞 ≥ 0.8, tier = mid …).
 */
import { COHORT_RULES, cohortGroupKey, rankGroup, type CohortMember } from './cohort'
import {
  deriveMetrics,
  withServiceFee,
  normalizeHealth,
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
import { SOURCE_IDS, type SourceId } from './source-adapter'

export type MetricFilter =
  | { key: NumericMetricKey; op: 'gte' | 'lte'; value: number }
  | { key: NumericMetricKey; op: 'between'; value: [number, number] }
  | { key: NumericMetricKey; op: 'percentileGte'; value: number }

export type HighlightTone = 'good' | 'warn' | 'bad'

/**
 * A row gets a coloured dot when a highlight holds. Metric highlights compare
 * the value (`gte` / `lte`) or its percentile among peers (`percentileGte` /
 * `percentileLte`, 0–100, higher = better whatever the metric's direction), and
 * may apply to some sources only. The health gate marks 健康「异常」 red and
 * then no "good" dot is shown for that row.
 */
export type MetricHighlight = {
  key: NumericMetricKey
  op: 'gte' | 'lte' | 'percentileGte' | 'percentileLte'
  value: number
  tone: HighlightTone
  sources?: SourceId[]
}
export type HealthGate = { key: 'health'; op: 'eq'; value: 'abnormal'; tone: 'bad' }
export type Highlight = MetricHighlight | HealthGate
export type HighlightFlag = { key: NumericMetricKey | 'health'; tone: HighlightTone }

export const HEALTH_GATE: HealthGate = { key: 'health', op: 'eq', value: 'abnormal', tone: 'bad' }

export function isHealthGate(h: Highlight): h is HealthGate {
  return h.key === 'health'
}

/**
 * Defaults, all relative to the creator's own peers (no absolute number
 * without a verified sample): health gate; CPE in the cheapest quarter →
 * good; engagement rate in the lowest quarter → warn; 蒲公英 read and
 * interaction medians ahead of at least half of similar creators → good.
 */
export function defaultHighlights(): Highlight[] {
  return [
    { ...HEALTH_GATE },
    { key: 'cpe', op: 'percentileGte', value: 75, tone: 'good' },
    { key: 'engagementRate', op: 'percentileLte', value: 25, tone: 'warn' },
    { key: 'readMedian', op: 'percentileGte', value: 50, tone: 'good', sources: ['pugongying'] },
    { key: 'interactionMedian', op: 'percentileGte', value: 50, tone: 'good', sources: ['pugongying'] },
  ]
}

/** Which highlights hold for one row. Percentile highlights need a percentile (none when stale or too few peers). */
export function highlightFlags(
  row: { source: string | null; metrics: CreatorMetrics; percentiles: MetricPercentiles },
  highlights: readonly Highlight[],
): HighlightFlag[] {
  const flags: HighlightFlag[] = []
  let gated = false
  for (const h of highlights) {
    if (isHealthGate(h)) {
      if (row.metrics.health === h.value) {
        gated = true
        flags.push({ key: 'health', tone: h.tone })
      }
      continue
    }
    if (h.sources?.length && !h.sources.includes(row.source as SourceId)) continue
    if (h.op === 'percentileGte' || h.op === 'percentileLte') {
      const p = row.percentiles[h.key]?.percentile
      if (p == null) continue
      if (h.op === 'percentileGte' ? p >= h.value : p <= h.value) flags.push({ key: h.key, tone: h.tone })
      continue
    }
    const v = row.metrics[h.key]
    if (v != null && (h.op === 'gte' ? v >= h.value : v <= h.value)) flags.push({ key: h.key, tone: h.tone })
  }
  return gated ? flags.filter((f) => f.tone !== 'good') : flags
}

/** Metric keys a highlight list reads. */
export function highlightKeys(highlights: readonly Highlight[]): NumericMetricKey[] {
  return highlights.filter((h): h is MetricHighlight => !isHealthGate(h)).map((h) => h.key)
}

/**
 * Extra condition groups on top of `filters` (which must all hold): an `any`
 * group keeps a row when at least one of its conditions holds; an `exclude`
 * group drops a row when all of its conditions hold. Empty groups do nothing.
 */
export type FilterGroup = { mode: 'any' | 'exclude'; filters: MetricFilter[] }
export const FILTER_GROUP_MODES = ['any', 'exclude'] as const

/** `private`: only the author sees and edits it (我的方案); `team`: everyone in the org (团队方案). */
export type QueryVisibility = 'private' | 'team'
export const QUERY_VISIBILITIES: readonly QueryVisibility[] = ['private', 'team']

export const SAVED_QUERY_LIMITS = { groups: 10, filtersPerGroup: 20, filters: 30, search: 100, categories: 50 } as const

export type SavedQuery = {
  id: string
  name: string
  version: number
  sources: SourceId[]
  tiers: CreatorTier[]
  health: HealthGrade[]
  regions: string[]
  brandsAny: string[]
  /** Category ids; a creator in any of them passes. */
  categories: string[]
  /** true: worked with us before; false: never; null: either. */
  hasCollaborated: boolean | null
  collabCountMin: number | null
  collabCountMax: number | null
  /** Saved name / creator key / 小红书号 search, applied with the page's own search box. */
  search: string
  filters: MetricFilter[]
  groups: FilterGroup[]
  sort: { key: NumericMetricKey | 'followers'; dir: 'asc' | 'desc' }
  highlights: Highlight[]
  /** Columns the pool table shows for this query, in order. */
  columns: NumericMetricKey[]
  /** Cost fields shown (and filtered) with this service fee added: 0, 10% or 20% (优效). */
  serviceFee: ServiceFeeRate
  visibility: QueryVisibility
}

/** A saved query as the API lists it: the spec plus who owns it and when it last changed. */
export type SavedQueryRecord = SavedQuery & {
  mine: boolean
  ownerId: string | null
  ownerName: string | null
  updatedAt: string | null
  updatedByName: string | null
  archivedAt: string | null
}

export type SavedQueryRevisionAction = 'create' | 'update' | 'archive' | 'restore'

/** One entry of a saved query's 修改记录: the query right after that change. */
export type SavedQueryRevision = {
  version: number
  action: SavedQueryRevisionAction
  name: string
  visibility: QueryVisibility
  spec: SavedQuery
  editedBy: string | null
  editedByName: string | null
  editedAt: string
}

export type QueryRow = {
  id: string
  creatorKey: string
  displayName: string
  source: SourceId
  regions: string[]
  coopBrands: string[]
  categories?: string[]
  collabCount?: number
  xhsId?: string | null
  metrics: CreatorMetrics
  /** Precomputed (the pool stores them at publish); computed here when absent. */
  percentiles?: MetricPercentiles
  stale?: boolean
}

/**
 * Percentiles are only comparable inside one group: data source (蒲公英 / 千瓜 /
 * 新红 measure "阅读中位数" differently) × window × content form, then among
 * creators of similar size (cohort.ts). `size` is the group's size; each
 * percentile carries its own n and follower range.
 */
export type PercentileCohort = {
  source: SourceId | null
  tier: CreatorTier
  size: number
  window: number
  contentForm: string | null
}

export type QueryResultRow<T extends QueryRow = QueryRow> = T & {
  tier: CreatorTier
  cohort: PercentileCohort
  percentiles: MetricPercentiles
  flags: HighlightFlag[]
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
    categories: [],
    hasCollaborated: null,
    collabCountMin: null,
    collabCountMax: null,
    search: '',
    filters: [],
    groups: [],
    sort: { key: 'cpe', dir: 'asc' },
    highlights: defaultHighlights(),
    columns: [...DEFAULT_QUERY_COLUMNS],
    serviceFee: 0,
    visibility: 'team',
    ...overrides,
  }
}

/**
 * A stored or posted spec, tidied: columns without repeats, a trimmed search,
 * and the old three health grades (优秀 / 正常 → 健康). Metric keys are taken
 * as they are (migration 0026 rewrote stored `cpv` / `retentionRate`); unknown
 * values are left for `validateSavedQuery` to reject.
 */
export function normalizeSavedQuery(value: unknown): Partial<SavedQuery> {
  if (!value || typeof value !== 'object') return {}
  const q = { ...(value as Record<string, any>) }
  if (Array.isArray(q.columns)) q.columns = [...new Set(q.columns)]
  if (typeof q.search === 'string') q.search = q.search.trim()
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
    if (s.filters.length > SAVED_QUERY_LIMITS.filters) errors.push('filters.tooMany')
    errors.push(...filterErrors(s.filters))
  }
  if (s.groups !== undefined) {
    if (!Array.isArray(s.groups) || s.groups.length > SAVED_QUERY_LIMITS.groups) errors.push('groups.shape')
    else {
      for (const g of s.groups) {
        if (!g || !FILTER_GROUP_MODES.includes(g.mode) || !Array.isArray(g.filters) || g.filters.length > SAVED_QUERY_LIMITS.filtersPerGroup) {
          errors.push('groups.shape')
        } else errors.push(...filterErrors(g.filters))
      }
    }
  }
  if (s.categories !== undefined
    && (!Array.isArray(s.categories) || s.categories.length > SAVED_QUERY_LIMITS.categories || s.categories.some((c) => typeof c !== 'string' || !c))) {
    errors.push('categories')
  }
  if (s.hasCollaborated !== undefined && s.hasCollaborated !== null && typeof s.hasCollaborated !== 'boolean') errors.push('hasCollaborated')
  const count = (v: unknown) => v === undefined || v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0)
  if (!count(s.collabCountMin) || !count(s.collabCountMax)) errors.push('collabCount')
  else if (s.collabCountMin != null && s.collabCountMax != null && s.collabCountMin > s.collabCountMax) errors.push('collabCount')
  if (s.search !== undefined && (typeof s.search !== 'string' || s.search.length > SAVED_QUERY_LIMITS.search)) errors.push('search')
  if (s.visibility !== undefined && !QUERY_VISIBILITIES.includes(s.visibility)) errors.push('visibility')
  if (!s.sort || (s.sort.key !== 'followers' && !METRIC_KEYS.includes(s.sort.key as NumericMetricKey))) errors.push('sort.key')
  if (!Array.isArray(s.columns) || !s.columns.length || s.columns.some((c) => !METRIC_KEYS.includes(c))) errors.push('columns')
  if (!Array.isArray(s.highlights) || s.highlights.some((h) => !validHighlight(h))) errors.push('highlights')
  if (s.serviceFee !== undefined && !SERVICE_FEE_RATES.includes(s.serviceFee as ServiceFeeRate)) errors.push('serviceFee')
  if (Array.isArray(s.health) && s.health.some((h) => !HEALTH_GRADES.includes(h as (typeof HEALTH_GRADES)[number]))) errors.push('health')
  return [...new Set(errors)]
}

function filterErrors(filters: readonly MetricFilter[]): string[] {
  const errors: string[] = []
  for (const f of filters) {
    if (!f || !METRIC_KEYS.includes(f.key)) errors.push('filters.key')
    else if (f.op === 'between') {
      if (!Array.isArray(f.value) || f.value.length !== 2 || !f.value.every((v) => typeof v === 'number' && Number.isFinite(v)) || f.value[0] > f.value[1]) {
        errors.push('filters.between')
      }
    } else if (f.op !== 'gte' && f.op !== 'lte' && f.op !== 'percentileGte') errors.push('filters.op')
    else if (typeof f.value !== 'number' || !Number.isFinite(f.value)) errors.push('filters.value')
    else if (f.op === 'percentileGte' && (f.value < 0 || f.value > 100)) errors.push('filters.percentile')
  }
  return errors
}

/** Every metric condition in the spec: `filters` and the ones inside groups. */
export function allFilters(q: Pick<SavedQuery, 'filters'> & { groups?: FilterGroup[] }): MetricFilter[] {
  return [...q.filters, ...(q.groups ?? []).flatMap((g) => g.filters)]
}

/** Name / creator key / 小红书号 contain the text (case-insensitive). */
export function matchesSearch(row: { displayName: string; creatorKey: string; xhsId?: string | null }, text: string): boolean {
  const needle = text.trim().toLowerCase()
  if (!needle) return true
  return [row.displayName, row.creatorKey, row.xhsId].filter((v) => v != null).join(' ').toLowerCase().includes(needle)
}

const HIGHLIGHT_TONES: readonly HighlightTone[] = ['good', 'warn', 'bad']

function validHighlight(h: unknown): boolean {
  if (!h || typeof h !== 'object') return false
  const x = h as Record<string, unknown>
  if (x.key === 'health') return x.op === 'eq' && x.value === 'abnormal' && x.tone === 'bad'
  if (!METRIC_KEYS.includes(x.key as NumericMetricKey)) return false
  if (!HIGHLIGHT_TONES.includes(x.tone as HighlightTone)) return false
  if (typeof x.value !== 'number' || !Number.isFinite(x.value)) return false
  if (x.op === 'percentileGte' || x.op === 'percentileLte') {
    if (x.value < 0 || x.value > 100) return false
  } else if (x.op !== 'gte' && x.op !== 'lte') return false
  if (x.sources !== undefined && (!Array.isArray(x.sources) || x.sources.some((v) => !SOURCE_IDS.includes(v as SourceId)))) return false
  return true
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
export function applySavedQuery<T extends QueryRow>(
  rows: readonly T[],
  q: SavedQuery,
  options: { target?: (source: string | null) => number } = {},
): QueryResultRow<T>[] {
  const fee = q.serviceFee ?? 0
  const derived = rows.map((r) => ({ ...r, metrics: deriveMetrics(r.metrics), tier: tierOf(r.metrics.followers) }))
  const groupOf = (r: (typeof derived)[number]) =>
    cohortGroupKey({ source: r.source ?? null, window: r.metrics.window, contentForm: r.metrics.contentForm ?? null })
  const groups = new Map<string, CohortMember[]>()
  for (const r of derived) {
    const key = groupOf(r)
    groups.set(key, [...(groups.get(key) ?? []), { id: r.id, followers: r.metrics.followers, metrics: r.metrics, stale: r.stale }])
  }
  const ranked = new Map<string, MetricPercentiles>()
  if (derived.some((r) => !r.percentiles)) {
    const sourceOf = new Map(derived.map((r) => [r.id, r.source ?? null]))
    for (const members of groups.values()) {
      const source = sourceOf.get(members[0].id) ?? null
      const target = options.target?.(source) ?? COHORT_RULES.analyticSample
      for (const [id, percentiles] of rankGroup(members, { target })) ranked.set(id, percentiles)
    }
  }
  const keys = new Set([...q.columns, ...allFilters(q).map((f) => f.key), ...highlightKeys(q.highlights)])
  let out: QueryResultRow<T>[] = derived.map((r) => {
    const all = r.percentiles ?? ranked.get(r.id) ?? {}
    const percentiles: MetricPercentiles = {}
    for (const key of keys) if (all[key]) percentiles[key] = all[key]
    const metrics = withServiceFee(r.metrics, fee)
    return {
    ...(r as T),
    metrics,
    tier: r.tier,
    cohort: {
      source: r.source ?? null,
      tier: r.tier,
      size: groups.get(groupOf(r))?.length ?? 0,
      window: r.metrics.window,
      contentForm: r.metrics.contentForm ?? null,
    },
    percentiles,
    flags: highlightFlags({ source: r.source ?? null, metrics, percentiles: all }, q.highlights),
    }
  })

  if (q.sources.length) out = out.filter((r) => q.sources.includes(r.source))
  if (q.tiers.length) out = out.filter((r) => q.tiers.includes(r.tier))
  if (q.health.length) out = out.filter((r) => r.metrics.health != null && q.health.includes(r.metrics.health))
  if (q.regions.length) out = out.filter((r) => r.regions.some((x) => q.regions.includes(x)))
  if (q.brandsAny.length) out = out.filter((r) => r.coopBrands.some((b) => q.brandsAny.includes(b)))
  const categories = q.categories ?? []
  if (categories.length) out = out.filter((r) => (r.categories ?? []).some((c) => categories.includes(c)))
  if (q.hasCollaborated != null) out = out.filter((r) => ((r.collabCount ?? 0) > 0) === q.hasCollaborated)
  if (q.collabCountMin != null) out = out.filter((r) => (r.collabCount ?? 0) >= q.collabCountMin!)
  if (q.collabCountMax != null) out = out.filter((r) => (r.collabCount ?? 0) <= q.collabCountMax!)
  if (q.search) out = out.filter((r) => matchesSearch(r, q.search))
  for (const f of q.filters) out = out.filter((r) => passes(r, f))
  for (const g of q.groups ?? []) {
    if (!g.filters.length) continue
    if (g.mode === 'any') out = out.filter((r) => g.filters.some((f) => passes(r, f)))
    else out = out.filter((r) => !g.filters.every((f) => passes(r, f)))
  }

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
