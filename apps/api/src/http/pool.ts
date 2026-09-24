/**
 * The select pool: filter, sort and page on `creator_published` (migration
 * 0023, written at publish / take-down by `published.ts`). Nothing here reads
 * `creators` for the list or writes anything; percentiles are the columns the
 * publish transaction stored (contract `cohort.ts`).
 *
 * A snapshot older than 60 days still lists but shows no percentile and never
 * passes a percentile filter, whatever the stored columns say until the next
 * refresh.
 */
import {
  COHORT_RULES,
  COST_METRIC_KEYS,
  CURRENCIES,
  METRIC_KEYS,
  RANKED_METRIC_KEYS,
  currencyExponent,
  emptyMetrics,
  isStale,
  normalizeCurrency,
  normalizeHealth,
  parsePaging,
  tierOf,
  withServiceFee,
  cohortGroupKey,
  highlightFlags,
  highlightKeys,
  type CreatorMetrics,
  type MetricPercentiles,
  type NumericMetricKey,
  type Paging,
  type SavedQuery,
} from '@kcs/contract'
import type { Db, Queryable } from '../db'
import { asPublished, attachCreatorMeta, parseMetrics, publicPoolRow } from './creators'
import { metricColumn, rankColumn, ranksFor } from './published'

const SNAPSHOT_KEYS = Object.keys(emptyMetrics())

/**
 * Every released row gets a complete, derived snapshot in `metrics_locked`.
 * Publish and seed already write one; this heals rows released before
 * snapshots existed or written straight to the table. Runs only at startup and
 * after seeding (then `refreshPublished` rebuilds the pool table from it).
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
              metrics_locked_at = COALESCE(metrics_locked_at, metrics_fetched_at, updated_at),
              metrics_locked_fetched_at = COALESCE(metrics_locked_fetched_at,
                LEAST(COALESCE(metrics_fetched_at, metrics_locked_at, updated_at), COALESCE(metrics_locked_at, updated_at)))
        WHERE id = $1 AND status = 'released'`,
      [item.id, JSON.stringify(asPublished(item).metrics)],
    )
  }
  return items.length
}

const EXPONENT_SQL = `(CASE p.price_currency ${CURRENCIES.map((code) => `WHEN '${code}' THEN ${10 ** currencyExponent(code)}`).join(' ')} ELSE 100 END)`
const TO_CNY_SQL = `(CASE WHEN p.price_currency = 'CNY' THEN 1 ELSE p.price_fx END)`

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

function numberParam(raw: string): number | null {
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function num(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function iso(value: unknown): string | null {
  if (value == null) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

const col = (key: NumericMetricKey | 'followers') => `p.${metricColumn(key)}`

function staleBefore(now: Date): Date {
  return new Date(now.getTime() - COHORT_RULES.staleDays * 86_400_000)
}

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number }

async function runPage(
  db: Queryable,
  where: string[],
  order: string,
  params: Params,
  paging: Paging,
): Promise<{ rows: Array<Record<string, any>>; total: number }> {
  const clause = ['NOT p.blacklisted', ...where].join('\n AND ')
  const values = [...params.values]
  const [page, counted] = await Promise.all([
    db.query(
      `SELECT p.* FROM creator_published p WHERE ${clause}
        ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, paging.pageSize, paging.offset],
    ),
    db.query(`SELECT count(*)::int AS total FROM creator_published p WHERE ${clause}`, values),
  ])
  return { rows: page.rows, total: counted.rows[0].total }
}

async function groupSizes(db: Queryable, keys: string[]): Promise<Map<string, number>> {
  if (!keys.length) return new Map()
  const { rows } = await db.query(
    `SELECT group_key, count(*)::int AS n FROM creator_published
      WHERE group_key = ANY($1) AND NOT blacklisted GROUP BY group_key`,
    [[...new Set(keys)]],
  )
  return new Map(rows.map((row) => [String(row.group_key), Number(row.n)]))
}

/** Pool-table rows → the same shape `publicPoolRow` has always sent. */
async function hydrate(db: Queryable, rows: Array<Record<string, any>>, now: Date) {
  if (!rows.length) return []
  const ids = rows.map((row) => String(row.creator_id))
  const [sources, sizes] = await Promise.all([
    db.query(
      `SELECT creator_id, source, external_id, first_seen_at, last_seen_at
         FROM creator_sources WHERE creator_id = ANY($1) ORDER BY first_seen_at`,
      [ids],
    ),
    groupSizes(db, rows.map((row) => String(row.group_key))),
  ])
  return rows.map((row) => {
    const metrics = parseMetrics(row.metrics, row.source) ?? emptyMetrics()
    const stale = isStale(row.fetched_at, now)
    const currency = row.price_currency == null ? null : String(row.price_currency)
    const major = (value: unknown) => (value == null || currency == null ? null : Number(value) / 10 ** currencyExponent(currency))
    return {
      id: String(row.creator_id),
      creatorKey: row.creator_key,
      displayName: row.display_name,
      followers: num(row.m_followers),
      followersUnknown: Boolean(row.followers_unknown),
      regions: row.regions ?? [],
      verticals: row.verticals ?? [],
      categories: row.categories ?? [],
      hasCollaborated: Number(row.collab_count) > 0,
      collabCount: Number(row.collab_count),
      collabBrands: row.collab_brands ?? [],
      price: currency
        ? { amountMin: major(row.price_min_minor), amountMax: major(row.price_max_minor), currency, unit: row.price_unit, fxToCny: num(row.price_fx) }
        : null,
      source: row.source ?? null,
      externalId: row.external_id ?? null,
      xhsId: row.xhs_id ?? null,
      sources: sources.rows
        .filter((item) => item.creator_id === row.creator_id)
        .map((item) => ({
          source: item.source,
          externalId: item.external_id,
          firstSeenAt: iso(item.first_seen_at),
          lastSeenAt: iso(item.last_seen_at),
        })),
      metricsFetchedAt: iso(row.latest_fetched_at),
      snapshotFetchedAt: iso(row.fetched_at),
      tier: String(row.tier),
      cohort: {
        source: row.source ?? null,
        tier: String(row.tier),
        size: sizes.get(String(row.group_key)) ?? 0,
        window: Number(row.window),
        contentForm: row.content_form ?? null,
      },
      metrics,
      percentiles: stale ? {} : ((row.ranks ?? {}) as MetricPercentiles),
      metricsLocked: metrics,
      metricsLockedAt: iso(row.published_at),
      stale,
    }
  })
}

function order(sortKey: NumericMetricKey | 'followers', dir: 'ASC' | 'DESC', tail: string[]): string {
  return [`${col(sortKey)} ${dir} NULLS LAST`, ...tail, 'p.creator_id COLLATE "C"'].join(', ')
}

function priceFilter(query: Record<string, string | undefined>, params: Params): string | null {
  if (!query.priceMin && !query.priceMax) return null
  const min = query.priceMin ? numberParam(query.priceMin) : 0
  const max = query.priceMax ? numberParam(query.priceMax) : Number.MAX_SAFE_INTEGER
  const currency = query.currency ? normalizeCurrency(query.currency) : null
  if (min == null || max == null || (query.currency && !currency)) return 'false'
  // With `currency`: that currency's own amounts. Without: 人民币, converting only
  // quotes that carry a recorded rate — never comparing 원 with 元 as numbers.
  const amount = (column: string) => `(p.${column}::numeric / ${EXPONENT_SQL})${currency ? '' : ` * ${TO_CNY_SQL}`}`
  return `(p.price_currency IS NOT NULL
    AND ${currency ? `p.price_currency = ${params.add(currency)}` : `${TO_CNY_SQL} IS NOT NULL`}
    AND COALESCE(${amount('price_min_minor')}, ${amount('price_max_minor')}, 0) <= ${params.add(max)}::numeric
    AND COALESCE(${amount('price_max_minor')}, ${amount('price_min_minor')}, 0) >= ${params.add(min)}::numeric)`
}

/**
 * GET /api/select/pool. Filters (all optional, lists comma-separated):
 * `q` `region` `brand` `tier` `health` `source` `categories` `category`
 * `verticals` `hasCollaborated` `collabCountMin/Max` `priceMin/Max` `currency`
 * `<metric>Min/Max`; `sort` (a metric or `followers`, default `cpe`) with
 * `dir` (alias `order`); `page` / `pageSize`.
 */
export async function poolPage(
  db: Db,
  query: Record<string, string | undefined>,
  now = new Date(),
): Promise<PageResult<Record<string, any>>> {
  const params = new Params()
  const where: string[] = []

  if (query.hasCollaborated === 'true') where.push('p.collab_count > 0')
  if (query.hasCollaborated === 'false') where.push('p.collab_count = 0')
  const price = priceFilter(query, params)
  if (price) where.push(price)
  if (query.categories) where.push(`p.categories && ${params.add(list(query.categories))}::text[]`)
  if (query.category) {
    const wanted = params.add(list(query.category))
    where.push(`(p.categories && ${wanted}::text[] OR p.verticals && ${wanted}::text[])`)
  }
  if (query.verticals) where.push(`p.verticals && ${params.add(list(query.verticals))}::text[]`)
  for (const [param, op] of [['collabCountMin', '>='], ['collabCountMax', '<=']] as const) {
    if (!query[param]) continue
    const n = numberParam(query[param]!)
    where.push(n == null ? 'false' : `p.collab_count ${op} ${params.add(n)}::float8`)
  }
  if (query.tier) where.push(`p.tier = ANY(${params.add(list(query.tier))}::text[])`)
  if (query.health) {
    const grades = list(query.health).map((grade) => normalizeHealth(grade, null, null).health ?? grade)
    where.push(`p.health = ANY(${params.add(grades)}::text[])`)
  }
  if (query.source) where.push(`p.source = ANY(${params.add(list(query.source))}::text[])`)
  if (query.region) {
    where.push(`EXISTS (SELECT 1 FROM unnest(p.regions) r, unnest(${params.add(list(query.region))}::text[]) w
      WHERE strpos(lower(r), lower(w)) > 0)`)
  }
  if (query.brand) {
    const wanted = list(query.brand).map((value) => value.toLowerCase()).filter(Boolean)
    if (!wanted.length) where.push('false')
    else {
      where.push(`EXISTS (SELECT 1 FROM unnest(${params.add(wanted)}::text[]) w WHERE strpos(lower(concat_ws(' ',
        NULLIF(array_to_string(p.collab_brands, ' '), ''),
        NULLIF(array_to_string(p.verticals, ' '), ''),
        p.display_name,
        NULLIF(array_to_string(p.categories, ' '), '')
      )), lower(w)) > 0)`)
    }
  }
  if (query.q) {
    where.push(`strpos(lower(concat_ws(' ', p.display_name, p.creator_key,
      NULLIF(array_to_string(p.regions, ' '), ''), NULLIF(array_to_string(p.verticals, ' '), ''),
      NULLIF(array_to_string(p.collab_brands, ' '), '')
    )), lower(${params.add(query.q)})) > 0`)
  }
  for (const key of METRIC_KEYS) {
    for (const [suffix, op] of [['Min', '>='], ['Max', '<=']] as const) {
      const raw = query[`${key}${suffix}`]
      if (raw == null || raw === '') continue
      const n = numberParam(raw)
      where.push(n == null ? 'false' : `${col(key)} ${op} ${params.add(n)}::float8`)
    }
  }

  const sortKey = (query.sort === 'followers' || METRIC_KEYS.includes(query.sort as NumericMetricKey)
    ? query.sort
    : 'cpe') as NumericMetricKey
  const dir = (query.dir ?? query.order ?? (sortKey === 'cpe' ? 'asc' : 'desc')) === 'asc' ? 'ASC' : 'DESC'
  const paging = parsePaging(query)
  const { rows, total } = await runPage(db, where, order(sortKey, dir, [`${col('followers')} DESC NULLS LAST`]), params, paging)
  const items = await hydrate(db, rows, now)
  return { items: items.map(publicPoolRow), total, page: paging.page, pageSize: paging.pageSize }
}

/** Keys a saved query shows: its columns, filters and highlights, in that order. */
export function savedQueryKeys(spec: SavedQuery): NumericMetricKey[] {
  return [...new Set([...spec.columns, ...spec.filters.map((f) => f.key), ...highlightKeys(spec.highlights)])]
}

/**
 * POST /api/select/queries/run — `applySavedQuery` over the pool table, plus
 * the page's free-text `q` (name / creator key / 小红书号). Order: the spec's
 * sort (nulls last), then CPE ascending, then followers descending, then id.
 */
export async function savedQueryPage(
  db: Db,
  spec: SavedQuery,
  query: Record<string, string | undefined>,
  now = new Date(),
): Promise<PageResult<Record<string, any>>> {
  const params = new Params()
  const where: string[] = []

  if (spec.sources.length) where.push(`p.source = ANY(${params.add(spec.sources)}::text[])`)
  if (spec.tiers.length) where.push(`p.tier = ANY(${params.add(spec.tiers)}::text[])`)
  if (spec.health.length) where.push(`p.health = ANY(${params.add(spec.health)}::text[])`)
  if (spec.regions.length) where.push(`p.regions && ${params.add(spec.regions)}::text[]`)
  if (spec.brandsAny.length) {
    const brands = params.add(spec.brandsAny)
    where.push(`(p.coop_brands && ${brands}::text[] OR p.collab_brands && ${brands}::text[])`)
  }
  const fee = spec.serviceFee ?? 0
  // Thresholds on cost fields are read with the chosen service fee added, as shown.
  const valueSql = (key: NumericMetricKey) => (fee && COST_METRIC_KEYS.includes(key) ? `(${col(key)} * ${1 + fee})` : col(key))
  let fresh: string | null = null
  for (const f of spec.filters) {
    if (f.op === 'percentileGte') {
      if (!RANKED_METRIC_KEYS.includes(f.key)) {
        where.push('false')
        continue
      }
      fresh ??= params.add(staleBefore(now))
      where.push(`(p.fetched_at IS NULL OR p.fetched_at >= ${fresh}::timestamptz)`)
      where.push(`p.${rankColumn(f.key)} >= ${params.add(Math.round(f.value * 10))}::int`)
    } else if (f.op === 'between') {
      where.push(`${valueSql(f.key)} BETWEEN ${params.add(f.value[0])}::float8 AND ${params.add(f.value[1])}::float8`)
    } else {
      where.push(`${valueSql(f.key)} ${f.op === 'gte' ? '>=' : '<='} ${params.add(f.value)}::float8`)
    }
  }
  const search = (query.q ?? '').trim()
  if (search) {
    where.push(`strpos(lower(concat_ws(' ', p.display_name, p.creator_key, p.xhs_id)), lower(${params.add(search)})) > 0`)
  }

  const paging = parsePaging(query)
  const { rows, total } = await runPage(
    db,
    where,
    order(spec.sort.key, spec.sort.dir === 'asc' ? 'ASC' : 'DESC', [
      `${col('cpe')} ASC NULLS LAST`,
      `${col('followers')} DESC NULLS LAST`,
    ]),
    params,
    paging,
  )
  const keys = savedQueryKeys(spec)
  const items = (await hydrate(db, rows, now)).map((item) => {
    const metrics = withServiceFee(item.metrics as CreatorMetrics, fee)
    const percentiles: MetricPercentiles = {}
    for (const key of keys) if (item.percentiles[key]) percentiles[key] = item.percentiles[key]
    return {
      id: item.id,
      creatorKey: String(item.creatorKey),
      displayName: String(item.displayName),
      source: item.source,
      regions: item.regions as string[],
      coopBrands: [...new Set([...(metrics.coopBrands ?? []), ...(item.collabBrands ?? [])])],
      metrics,
      tier: item.tier,
      cohort: item.cohort,
      percentiles,
      flags: highlightFlags({ source: item.source, metrics, percentiles: item.percentiles }, spec.highlights),
      health: metrics.health,
      stale: item.stale,
    }
  })
  return { items, total, page: paging.page, pageSize: paging.pageSize }
}

/**
 * Tier, cohort and percentiles for creators shown outside the list (detail,
 * shortlist, project): the stored ranks when they are in the pool, otherwise
 * ranked against their group as it stands. Read only.
 */
export async function withPercentiles<T extends Record<string, any>>(
  db: Queryable,
  items: T[],
  keys: readonly NumericMetricKey[] = RANKED_METRIC_KEYS,
  now = new Date(),
): Promise<Array<T & { tier: string; cohort: Record<string, unknown>; percentiles: MetricPercentiles; stale: boolean }>> {
  if (!items.length) return []
  const input = items.map((item) => {
    const metrics = item.metrics as CreatorMetrics
    const source: string | null = item.source ?? null
    const group = cohortGroupKey({ source, window: metrics.window, contentForm: metrics.contentForm ?? null })
    return { id: String(item.id), source, metrics, group, stale: isStale(item.snapshotFetchedAt, now) }
  })
  const [ranks, sizes] = await Promise.all([
    ranksFor(db, input, now),
    groupSizes(db, input.map((row) => row.group)),
  ])
  return items.map((item, index) => {
    const { metrics, source, group, stale } = input[index]
    const all = ranks.get(input[index].id) ?? {}
    const percentiles: MetricPercentiles = {}
    for (const key of keys) if (all[key]) percentiles[key] = all[key]
    const tier = tierOf(metrics.followers)
    return {
      ...item,
      followers: metrics.followers,
      tier,
      cohort: { source, tier, size: sizes.get(group) ?? 0, window: metrics.window, contentForm: metrics.contentForm ?? null },
      percentiles,
      stale,
    }
  })
}
