/**
 * The select pool in SQL: filter, sort, page and rank on the publish snapshot
 * (`creators.metrics_locked`) without loading the pool into Node.
 *
 * Percentiles are the contract's cohort semantics (`percentileTenths`): cohort
 * = source × follower tier over every published, non-blacklisted creator; nulls
 * never ranked; fewer than two values → no percentile; low-is-better inverted.
 * Two ways to get the same integers:
 * - `rankedCte` — window functions over the whole published set, used when a
 *   saved query filters on a percentile (`percentileGte`) before paging;
 * - `withPercentiles` — grouped counts for just the rows on the page (and for
 *   detail / shortlist / project rows, which may no longer be in the pool).
 */
import {
  CREATOR_TIERS,
  METRIC_KEYS,
  RANKED_METRIC_KEYS,
  directedPercentileTenths,
  bandOf,
  emptyMetrics,
  metricField,
  parsePaging,
  tierOf,
  type CreatorMetrics,
  type MetricPercentiles,
  type NumericMetricKey,
  type Paging,
  type SavedQuery,
} from '@kcs/contract'
import type { Db } from '../db'
import { asPublished, attachCreatorMeta, publicPoolRow } from './creators'

const SNAPSHOT_KEYS = Object.keys(emptyMetrics())

export const PUBLISHED_WHERE = `c.status = 'released' AND NOT EXISTS (
  SELECT 1 FROM creator_categories bl WHERE bl.creator_id = c.id AND bl.category_slug = 'blacklist'
)`

/** A numeric metric from the publish snapshot; non-numbers read as null. */
export function metricSql(key: NumericMetricKey, alias = 'c'): string {
  if (!METRIC_KEYS.includes(key)) throw new Error(`unknown metric ${key}`)
  return `(CASE WHEN jsonb_typeof(${alias}.metrics_locked->'${key}') = 'number'
    THEN (${alias}.metrics_locked->>'${key}')::float8 END)`
}

/**
 * Several snapshot metrics at once: `jsonb_to_record` unpacks the (usually
 * compressed) jsonb once per row instead of once per metric.
 */
export function snapshotValues(keys: readonly NumericMetricKey[], alias = 'c') {
  const unique = [...new Set(keys)]
  for (const key of unique) if (!METRIC_KEYS.includes(key)) throw new Error(`unknown metric ${key}`)
  return {
    lateral: `CROSS JOIN LATERAL jsonb_to_record(CASE WHEN jsonb_typeof(${alias}.metrics_locked) = 'object'
      THEN ${alias}.metrics_locked ELSE '{}'::jsonb END) AS snap(${unique.map((key) => `"${key}" jsonb`).join(', ')})`,
    col: (key: NumericMetricKey) =>
      `(CASE WHEN jsonb_typeof(snap."${key}") = 'number' THEN (snap."${key}")::float8 END)`,
  }
}

/** `tierOf` in SQL, generated from the same thresholds. */
export function tierSql(followers: string): string {
  const branches = CREATOR_TIERS.filter((tier) => tier.min > 0)
    .map((tier) => `WHEN COALESCE(${followers}, 0) >= ${tier.min} THEN '${tier.id}'`)
    .join(' ')
  return `(CASE ${branches} ELSE 'unknown' END)`
}

const TIER = tierSql(metricSql('followers'))
const HEALTH = `(c.metrics_locked->>'health')`

class Params {
  readonly values: unknown[] = []
  add(value: unknown): string {
    this.values.push(value)
    return `$${this.values.length}`
  }
}

function list(raw: string | undefined): string[] {
  return raw ? raw.split(',') : []
}

/**
 * Every released row gets a complete, derived snapshot, so SQL can read
 * `metrics_locked` exactly as `asPublished` would. Publish and seed already
 * write one; this heals rows released before snapshots existed or written
 * straight to the table. `full` also re-checks every snapshot for missing keys
 * (it reads each jsonb). Runs only at startup and after seeding; migration
 * 0020 covers the SQL-only case, so no read path ever writes.
 */
export async function ensurePublishedSnapshots(db: Db, options: { full?: boolean } = {}): Promise<number> {
  const { rows } = await db.query(
    options.full
      ? `SELECT * FROM creators
          WHERE status = 'released'
            AND (metrics_locked IS NULL OR jsonb_typeof(metrics_locked) <> 'object'
                 OR NOT (metrics_locked ?& $1::text[]))`
      : `SELECT * FROM creators WHERE status = 'released' AND metrics_locked IS NULL AND $1::text[] IS NOT NULL`,
    [SNAPSHOT_KEYS],
  )
  if (!rows.length) return 0
  const items = await attachCreatorMeta(db, rows, false)
  for (const item of items) {
    await db.query(
      `UPDATE creators
          SET metrics_locked = $2,
              metrics_locked_at = COALESCE(metrics_locked_at, metrics_fetched_at, updated_at)
        WHERE id = $1 AND status = 'released'`,
      [item.id, JSON.stringify(asPublished(item).metrics)],
    )
  }
  return items.length
}

type Cohort = { source: string | null; tier: string; size: number } | null

type CohortMode = {
  /** Saved queries rank source-less rows as their own cohort; the plain pool does not rank them. */
  nullSourceCohort: boolean
  keys: readonly NumericMetricKey[]
}

/**
 * Percentiles and cohort for a handful of rows against the published pool,
 * via one grouped count per row. Each row's own snapshot values are compared,
 * so a row that has left the pool is ranked against who is still in it.
 */
export async function withPercentiles<T extends Record<string, any>>(
  db: Db,
  items: T[],
  mode: CohortMode,
): Promise<Array<T & { tier: string; cohort: Cohort; percentiles: MetricPercentiles }>> {
  if (!items.length) return []
  const keys = mode.keys.filter((key) => RANKED_METRIC_KEYS.includes(key))
  const input = items.map((item) => {
    const metrics = item.metrics as CreatorMetrics
    const source: string | null = item.source ?? null
    return { source, tier: tierOf(metrics.followers), metrics, ranked: source != null || mode.nullSourceCohort }
  })
  const wanted = [...new Map(
    input.filter((row) => row.ranked).map((row) => [`${row.source}\u0000${row.tier}`, { source: row.source, tier: row.tier }]),
  ).values()]
  const cohorts = new Map<string, { size: number; sorted: number[][] }>()
  if (wanted.length) {
    const snapshot = snapshotValues(['followers', ...keys])
    // One sorted value list per (cohort, metric); the rows on the page are
    // then counted against it by binary search instead of row-by-row in SQL.
    const { rows } = await db.query(
      `WITH base AS (
         SELECT c.source, ${tierSql(snapshot.col('followers'))} AS tier
                ${keys.map((key, i) => `, ${snapshot.col(key)} AS m${i}`).join('')}
           FROM creators c ${snapshot.lateral}
          WHERE ${PUBLISHED_WHERE}
       ), wanted AS (
         SELECT * FROM jsonb_to_recordset($1::jsonb) AS w(source text, tier text)
       )
       SELECT b.source, b.tier, count(*)::int AS size
              ${keys.map((_, i) => `, array_agg(b.m${i} ORDER BY b.m${i}) FILTER (WHERE b.m${i} IS NOT NULL) AS a${i}`).join('')}
         FROM base b JOIN wanted w ON b.source IS NOT DISTINCT FROM w.source AND b.tier = w.tier
        GROUP BY b.source, b.tier`,
      [JSON.stringify(wanted)],
    )
    for (const row of rows) {
      cohorts.set(`${row.source}\u0000${row.tier}`, {
        size: Number(row.size),
        sorted: keys.map((_, i) => (row[`a${i}`] ?? []).map(Number)),
      })
    }
  }
  return items.map((item, idx) => {
    const { source, tier, metrics, ranked } = input[idx]
    const cohort = cohorts.get(`${source}\u0000${tier}`)
    const percentiles: MetricPercentiles = {}
    if (ranked && cohort) {
      keys.forEach((key, i) => {
        const value = metrics[key]
        if (typeof value !== 'number') return
        const sorted = cohort.sorted[i]
        const below = firstIndex(sorted, (v) => v >= value)
        const equal = firstIndex(sorted, (v) => v > value) - below
        const tenths = directedPercentileTenths(key, below, equal, sorted.length)
        if (tenths == null) return
        percentiles[key] = { percentile: tenths / 10, band: bandOf(tenths / 10) }
      })
    }
    return {
      ...item,
      followers: metrics.followers,
      tier,
      cohort: ranked ? { source, tier, size: cohort?.size ?? 0 } : null,
      percentiles,
    }
  })
}

function firstIndex(sorted: number[], test: (value: number) => boolean): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (test(sorted[mid])) hi = mid
    else lo = mid + 1
  }
  return lo
}

/**
 * Per-row directed percentile (tenths) for `keys` over the whole published
 * set, partitioned by source × tier (NULL source is its own partition).
 */
function rankedCte(keys: readonly NumericMetricKey[]): string {
  const snapshot = snapshotValues(['followers', ...keys])
  const cols = keys.map((key, i) => {
    if (!metricField(key).better) return `NULL::bigint AS p${i}`
    const cohort = 'PARTITION BY source, tier'
    const below = `(rank() OVER (${cohort} ORDER BY m${i}) - 1)`
    const equal = `count(*) OVER (${cohort}, m${i})`
    const n = `count(m${i}) OVER (${cohort})`
    const tenths = `((1000 * (2 * ${below} + ${equal}) + ${n}) / (2 * ${n}))`
    const low = metricField(key).better === 'low'
    return `CASE WHEN m${i} IS NULL OR ${n} < 2 THEN NULL ELSE ${low ? `1000 - ${tenths}` : tenths} END AS p${i}`
  })
  return `ranked AS (
    SELECT id ${cols.length ? `, ${cols.join(', ')}` : ''}
      FROM (
        SELECT c.id, c.source, ${tierSql(snapshot.col('followers'))} AS tier
               ${keys.map((key, i) => `, ${snapshot.col(key)} AS m${i}`).join('')}
          FROM creators c ${snapshot.lateral} WHERE ${PUBLISHED_WHERE}
      ) published
  )`
}

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number }

async function runPage(
  db: Db,
  sql: { with?: string; join?: string; where: string[]; order: string },
  params: Params,
  paging: Paging,
): Promise<{ ids: string[]; total: number }> {
  const where = [PUBLISHED_WHERE, ...sql.where].join('\n AND ')
  const from = `FROM creators c ${sql.join ?? ''} WHERE ${where}`
  const prefix = sql.with ? `WITH ${sql.with}` : ''
  const limit = params.add(paging.pageSize)
  const offset = params.add(paging.offset)
  const { rows } = await db.query(
    `${prefix} SELECT c.id, count(*) OVER ()::int AS total ${from}
      ORDER BY ${sql.order} LIMIT ${limit} OFFSET ${offset}`,
    params.values,
  )
  if (rows.length || paging.offset === 0) {
    return { ids: rows.map((row) => String(row.id)), total: rows[0]?.total ?? 0 }
  }
  const counted = await db.query(`${prefix} SELECT count(*)::int AS total ${from}`, params.values.slice(0, -2))
  return { ids: [], total: counted.rows[0].total }
}

async function loadPublished(db: Db, ids: string[]) {
  if (!ids.length) return []
  const { rows } = await db.query('SELECT * FROM creators WHERE id = ANY($1)', [ids])
  const byId = new Map((await attachCreatorMeta(db, rows, false)).map((item) => [item.id, item]))
  return ids.map((id) => asPublished(byId.get(id)!))
}

function numberParam(raw: string): number | null {
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

function order(sortKey: NumericMetricKey, dir: 'ASC' | 'DESC', tail: string[]): string {
  return [`${metricSql(sortKey)} ${dir} NULLS LAST`, ...tail, 'c.id COLLATE "C"'].join(', ')
}

const COLLAB_COUNT = '(SELECT count(*) FROM collaborations col WHERE col.creator_id = c.id)'

/**
 * GET /api/select/pool. Filters (all optional, lists comma-separated):
 * `q` `region` `brand` `tier` `health` `source` `categories` `category`
 * `verticals` `hasCollaborated` `collabCountMin/Max` `priceMin/Max` `currency`
 * `<metric>Min/Max`; `sort` (a metric or `followers`, default `cpe`) with
 * `dir` (alias `order`); `page` / `pageSize`.
 */
export async function poolPage(db: Db, query: Record<string, string | undefined>): Promise<PageResult<Record<string, any>>> {
  const params = new Params()
  const where: string[] = []

  if (query.hasCollaborated === 'true') where.push(`${COLLAB_COUNT} > 0`)
  if (query.hasCollaborated === 'false') where.push(`${COLLAB_COUNT} = 0`)
  if (query.priceMin || query.priceMax) {
    const min = query.priceMin ? numberParam(query.priceMin) : 0
    const max = query.priceMax ? numberParam(query.priceMax) : Number.MAX_SAFE_INTEGER
    if (min == null || max == null) where.push('false')
    else {
      where.push(`EXISTS (
        SELECT 1 FROM (SELECT * FROM prices pr WHERE pr.creator_id = c.id LIMIT 1) pr
         WHERE COALESCE(pr.amount_min, pr.amount_max, 0) <= ${params.add(max)}::float8
           AND COALESCE(pr.amount_max, pr.amount_min, 0) >= ${params.add(min)}::float8
           ${query.currency ? `AND pr.currency = ${params.add(query.currency)}` : ''})`)
    }
  }
  if (query.categories) {
    where.push(`EXISTS (SELECT 1 FROM creator_categories cc WHERE cc.creator_id = c.id
      AND cc.category_slug = ANY(${params.add(list(query.categories))}::text[]))`)
  }
  if (query.category) {
    const wanted = params.add(list(query.category))
    where.push(`(EXISTS (SELECT 1 FROM creator_categories cc WHERE cc.creator_id = c.id
      AND cc.category_slug = ANY(${wanted}::text[])) OR c.verticals && ${wanted}::text[])`)
  }
  if (query.verticals) where.push(`c.verticals && ${params.add(list(query.verticals))}::text[]`)
  for (const [param, op] of [['collabCountMin', '>='], ['collabCountMax', '<=']] as const) {
    if (!query[param]) continue
    const n = numberParam(query[param]!)
    where.push(n == null ? 'false' : `${COLLAB_COUNT} ${op} ${params.add(n)}::float8`)
  }
  if (query.tier) where.push(`${TIER} = ANY(${params.add(list(query.tier))}::text[])`)
  if (query.health) where.push(`${HEALTH} = ANY(${params.add(list(query.health))}::text[])`)
  if (query.source) where.push(`c.source = ANY(${params.add(list(query.source))}::text[])`)
  if (query.region) {
    where.push(`EXISTS (SELECT 1 FROM unnest(c.regions) r, unnest(${params.add(list(query.region))}::text[]) w
      WHERE strpos(lower(r), lower(w)) > 0)`)
  }
  if (query.brand) {
    const wanted = list(query.brand).map((value) => value.toLowerCase()).filter(Boolean)
    if (!wanted.length) where.push('false')
    else {
      where.push(`EXISTS (SELECT 1 FROM unnest(${params.add(wanted)}::text[]) w WHERE strpos(lower(concat_ws(' ',
        (SELECT string_agg(col.brand, ' ') FROM collaborations col WHERE col.creator_id = c.id),
        NULLIF(array_to_string(c.verticals, ' '), ''),
        c.display_name,
        (SELECT string_agg(cc.category_slug, ' ') FROM creator_categories cc WHERE cc.creator_id = c.id)
      )), lower(w)) > 0)`)
    }
  }
  if (query.q) {
    where.push(`strpos(lower(concat_ws(' ', c.display_name, c.creator_key,
      NULLIF(array_to_string(c.regions, ' '), ''), NULLIF(array_to_string(c.verticals, ' '), ''),
      (SELECT string_agg(col.brand, ' ') FROM collaborations col WHERE col.creator_id = c.id)
    )), lower(${params.add(query.q)})) > 0`)
  }
  for (const key of METRIC_KEYS) {
    for (const [suffix, op] of [['Min', '>='], ['Max', '<=']] as const) {
      const raw = query[`${key}${suffix}`]
      if (raw == null || raw === '') continue
      const n = numberParam(raw)
      where.push(n == null ? 'false' : `${metricSql(key)} ${op} ${params.add(n)}::float8`)
    }
  }

  const sortKey = (query.sort === 'followers' || METRIC_KEYS.includes(query.sort as NumericMetricKey)
    ? query.sort
    : 'cpe') as NumericMetricKey
  const dir = (query.dir ?? query.order ?? (sortKey === 'cpe' ? 'asc' : 'desc')) === 'asc' ? 'ASC' : 'DESC'
  const paging = parsePaging(query)
  const { ids, total } = await runPage(
    db,
    { where, order: order(sortKey, dir, [`${metricSql('followers')} DESC NULLS LAST`]) },
    params,
    paging,
  )
  const items = await withPercentiles(db, await loadPublished(db, ids), {
    nullSourceCohort: false,
    keys: RANKED_METRIC_KEYS,
  })
  return { items: items.map(publicPoolRow), total, page: paging.page, pageSize: paging.pageSize }
}

/** Keys a saved query ranks: its columns, filters and highlights, in that order. */
export function savedQueryKeys(spec: SavedQuery): NumericMetricKey[] {
  return [...new Set([...spec.columns, ...spec.filters.map((f) => f.key), ...spec.highlights.map((h) => h.key)])]
}

/**
 * POST /api/select/queries/run — `applySavedQuery` in SQL, plus the page's
 * free-text `q` (name / creator key / 小红书号). Order: the spec's sort (nulls
 * last), then CPE ascending, then followers descending, then id.
 */
export async function savedQueryPage(
  db: Db,
  spec: SavedQuery,
  query: Record<string, string | undefined>,
): Promise<PageResult<Record<string, any>>> {
  const params = new Params()
  const where: string[] = []

  if (spec.sources.length) where.push(`c.source = ANY(${params.add(spec.sources)}::text[])`)
  if (spec.tiers.length) where.push(`${TIER} = ANY(${params.add(spec.tiers)}::text[])`)
  if (spec.health.length) where.push(`${HEALTH} = ANY(${params.add(spec.health)}::text[])`)
  if (spec.regions.length) where.push(`c.regions && ${params.add(spec.regions)}::text[]`)
  if (spec.brandsAny.length) {
    const brands = params.add(spec.brandsAny)
    where.push(`(EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(c.metrics_locked->'coopBrands') = 'array'
          THEN c.metrics_locked->'coopBrands' ELSE '[]'::jsonb END) b WHERE b = ANY(${brands}::text[]))
      OR EXISTS (SELECT 1 FROM collaborations col WHERE col.creator_id = c.id AND col.brand = ANY(${brands}::text[])))`)
  }
  const ranked = [...new Set(spec.filters.filter((f) => f.op === 'percentileGte').map((f) => f.key))]
  for (const f of spec.filters) {
    if (f.op === 'percentileGte') {
      where.push(`r.p${ranked.indexOf(f.key)}::float8 / 10 >= ${params.add(f.value)}::float8`)
    } else if (f.op === 'between') {
      where.push(`${metricSql(f.key)} BETWEEN ${params.add(f.value[0])}::float8 AND ${params.add(f.value[1])}::float8`)
    } else {
      where.push(`${metricSql(f.key)} ${f.op === 'gte' ? '>=' : '<='} ${params.add(f.value)}::float8`)
    }
  }
  const search = (query.q ?? '').trim()
  if (search) {
    where.push(`strpos(lower(concat_ws(' ', c.display_name, c.creator_key, c.xhs_id)), lower(${params.add(search)})) > 0`)
  }

  const paging = parsePaging(query)
  const { ids, total } = await runPage(
    db,
    {
      with: ranked.length ? rankedCte(ranked) : undefined,
      join: ranked.length ? 'JOIN ranked r ON r.id = c.id' : undefined,
      where,
      order: order(spec.sort.key as NumericMetricKey, spec.sort.dir === 'asc' ? 'ASC' : 'DESC', [
        `${metricSql('cpe')} ASC NULLS LAST`,
        `${metricSql('followers')} DESC NULLS LAST`,
      ]),
    },
    params,
    paging,
  )
  const rows = await withPercentiles(db, await loadPublished(db, ids), {
    nullSourceCohort: true,
    keys: savedQueryKeys(spec),
  })
  const items = rows.map((item) => {
    const metrics = item.metrics as CreatorMetrics
    return {
      id: String(item.id),
      creatorKey: String(item.creatorKey),
      displayName: String(item.displayName),
      source: item.source,
      regions: item.regions as string[],
      coopBrands: [...new Set([...(metrics.coopBrands ?? []), ...(item.collabBrands ?? [])])],
      metrics,
      tier: item.tier,
      cohort: item.cohort,
      percentiles: item.percentiles,
      flags: spec.highlights
        .filter((h) => {
          const v = metrics[h.key]
          return v != null && (h.op === 'gte' ? v >= h.value : v <= h.value)
        })
        .map((h) => ({ key: h.key, tone: h.tone })),
      health: metrics.health,
    }
  })
  return { items, total, page: paging.page, pageSize: paging.pageSize }
}
