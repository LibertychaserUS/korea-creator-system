import {
  cohortKey,
  cohortPercentiles,
  creatorStage,
  defaultSavedQuery,
  deriveMetrics,
  emptyMetrics,
  METRIC_KEYS,
  tierOf,
  type CreatorMetrics,
  type NumericMetricKey,
  type SavedQuery,
  type SourceId,
  type SourceQuery,
} from '@kcs/contract'
import type { Db } from '../db'

export function hasCollabSql() {
  return `(SELECT count(*) FROM collaborations col WHERE col.creator_id = c.id)`
}

export function assetPublicUrl(key: string) {
  const base = (process.env.API_PUBLIC_URL || 'http://localhost:7100').replace(/\/$/, '')
  return `${base}/api/assets/raw/${key}`
}

export function mutexCoop(categories: unknown): boolean {
  return Array.isArray(categories)
    && categories.includes('collaborated')
    && categories.includes('never_collaborated')
}

export function publicPoolRow(item: Record<string, any>) {
  return {
    id: item.id,
    creatorKey: item.creatorKey,
    displayName: item.displayName,
    followers: item.followers,
    followersUnknown: item.followersUnknown,
    regions: item.regions,
    verticals: item.verticals,
    categories: item.categories,
    hasCollaborated: item.hasCollaborated,
    collabCount: item.collabCount,
    collabBrands: item.collabBrands,
    price: item.price,
    source: item.source,
    externalId: item.externalId,
    sources: item.sources,
    metricsFetchedAt: item.metricsFetchedAt,
    tier: item.tier,
    cohort: item.cohort,
    metrics: item.metrics,
    percentiles: item.percentiles,
    health: item.metrics.health,
    metricsLocked: item.metricsLocked,
    metricsLockedAt: item.metricsLockedAt,
  }
}

/**
 * The select side sees a creator as it was at publish: `metrics` becomes the
 * snapshot, so every filter, sort and percentile runs on it; the latest ingest
 * stays available as `metricsLatest` for side-by-side display. Rows released
 * before snapshots existed fall back to their current numbers.
 */
export function asPublished<T extends Record<string, any>>(item: T): T & { metricsLatest: CreatorMetrics } {
  return { ...item, metrics: item.metricsLocked ?? item.metrics, metricsLatest: item.metrics }
}

export function camelJobs(rows: Array<Record<string, any>>) {
  return rows.map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    schedule: row.schedule,
    status: row.status,
    attempt: Number(row.attempt),
    writtenCount: Number(row.written_count),
    skippedDupes: Number(row.skipped_dupes),
    failedCount: Number(row.failed_count),
    errorCode: row.error_code,
    errorSummary: row.error_summary,
    sampleRate: Number(row.sample_rate),
    fileName: row.file_name ?? null,
    batchName: row.batch_name ?? null,
    sourceRows: row.source_rows == null ? null : Number(row.source_rows),
    query: row.query ?? null,
    sourceMode: row.source_mode ?? null,
    pagesDone: Number(row.pages_done ?? 0),
    cursor: row.cursor ?? null,
    quotaUsed: Number(row.quota_used ?? 0),
    attempts: Number(row.attempts ?? row.attempt ?? 0),
    nextRunAt: row.next_run_at ?? null,
    error: row.error ?? row.error_summary ?? null,
    maxPages: Number(row.max_pages ?? 5),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
  }))
}

export async function readUpload(file: unknown): Promise<{ name: string; buf: Buffer } | null> {
  if (!file || typeof file !== 'object') return null
  const blob = file as { name?: string; arrayBuffer?: () => Promise<ArrayBuffer> }
  if (typeof blob.arrayBuffer !== 'function') return null
  const buf = Buffer.from(await blob.arrayBuffer())
  if (!buf.length) return null
  return { name: blob.name || 'upload.xlsx', buf }
}

export async function saveRelations(db: Db, creatorId: string, body: Record<string, any>) {
  if (Array.isArray(body.categories)) {
    await db.query('DELETE FROM creator_categories WHERE creator_id = $1', [creatorId])
    for (const slug of body.categories as string[]) {
      await db.query(
        'INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [creatorId, slug],
      )
    }
  }
  if (Array.isArray(body.collaborations)) {
    await db.query('DELETE FROM collaborations WHERE creator_id = $1', [creatorId])
    for (const col of body.collaborations as Array<{ brand: string; happenedAt?: string; note?: string }>) {
      await db.query(
        `INSERT INTO collaborations (id, creator_id, brand, happened_at, note)
         VALUES (gen_random_uuid()::text,$1,$2,$3,$4)`,
        [creatorId, col.brand, col.happenedAt ?? null, col.note ?? null],
      )
    }
  }
  if (body.price && typeof body.price === 'object') {
    const price = body.price as {
      amountMin?: number
      amountMax?: number
      currency?: string
      unit?: string
    }
    await db.query('DELETE FROM prices WHERE creator_id = $1', [creatorId])
    await db.query(
      `INSERT INTO prices (id, creator_id, amount_min, amount_max, currency, unit)
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5)`,
      [
        creatorId,
        price.amountMin ?? null,
        price.amountMax ?? null,
        price.currency ?? 'CNY',
        price.unit ?? 'per_post',
      ],
    )
  }
}

/** One record per day and source (the day's last fetch), oldest first. */
export async function creatorHistory(
  db: Db,
  creatorId: string,
  query: Record<string, string | undefined>,
) {
  const window = query.window === '90' ? 90 : 30
  const limit = Math.max(1, Math.min(200, Number(query.limit || 60)))
  const { rows } = await db.query(
    `SELECT * FROM (
       SELECT DISTINCT ON ((fetched_at AT TIME ZONE 'UTC')::date, source)
         id, creator_id, source, "window", fetched_at, job_id, metrics
       FROM creator_metrics_history
       WHERE creator_id = $1 AND "window" = $2
       ORDER BY (fetched_at AT TIME ZONE 'UTC')::date, source, fetched_at DESC
     ) snapshots
     ORDER BY fetched_at DESC
     LIMIT $3`,
    [creatorId, window, limit],
  )
  return rows.reverse().map((row) => ({
    id: row.id,
    creatorId: row.creator_id,
    source: row.source,
    window: Number(row.window),
    fetchedAt: isoOrNull(row.fetched_at),
    jobId: row.job_id ?? null,
    metrics: parseMetrics(row.metrics),
  }))
}

export async function attachCreatorMeta(
  db: Db,
  rows: Array<Record<string, any>>,
  full: boolean,
): Promise<Array<Record<string, any>>> {
  const ids = rows.map((row) => row.id)
  if (!ids.length) return []
  const [cats, collaborations, prices, sources] = await Promise.all([
    db.query('SELECT creator_id, category_slug FROM creator_categories WHERE creator_id = ANY($1)', [ids]),
    db.query('SELECT * FROM collaborations WHERE creator_id = ANY($1)', [ids]),
    db.query('SELECT * FROM prices WHERE creator_id = ANY($1)', [ids]),
    db.query(
      `SELECT creator_id, source, external_id, first_seen_at, last_seen_at
       FROM creator_sources WHERE creator_id = ANY($1) ORDER BY first_seen_at`,
      [ids],
    ),
  ])
  return rows.map((row) => {
    const categories = cats.rows
      .filter((item) => item.creator_id === row.id)
      .map((item) => item.category_slug)
    const creatorCollaborations = collaborations.rows.filter((item) => item.creator_id === row.id)
    const price = prices.rows.find((item) => item.creator_id === row.id)
    const metrics = metricsFromRow({ ...row, price })
    return {
      id: row.id,
      creatorKey: row.creator_key,
      displayName: row.display_name,
      status: row.status,
      needsReview: row.needs_review,
      followers: row.followers === null ? null : Number(row.followers),
      followersUnknown: row.followers_unknown,
      regions: row.regions,
      verticals: row.verticals,
      avatarKey: row.avatar_key ?? null,
      xhsId: row.xhs_id ?? null,
      qcNotes: row.qc_notes ?? null,
      note: row.note ?? null,
      label: row.label ?? null,
      categories,
      hasCollaborated: creatorCollaborations.length > 0,
      collabCount: creatorCollaborations.length,
      collabBrands: creatorCollaborations.map((item) => item.brand),
      source: row.source ?? null,
      externalId: row.external_id ?? null,
      metrics,
      metricsLocked: parseMetrics(row.metrics_locked),
      metricsLockedAt: isoOrNull(row.metrics_locked_at),
      stage: creatorStage({ status: row.status, metricsLockedAt: row.metrics_locked_at }),
      metricsFetchedAt: row.metrics_fetched_at ?? null,
      updatedAt: isoOrNull(row.updated_at),
      sources: sources.rows
        .filter((item) => item.creator_id === row.id)
        .map((item) => ({
          source: item.source,
          externalId: item.external_id,
          firstSeenAt: item.first_seen_at instanceof Date
            ? item.first_seen_at.toISOString()
            : String(item.first_seen_at),
          lastSeenAt: item.last_seen_at instanceof Date
            ? item.last_seen_at.toISOString()
            : String(item.last_seen_at),
        })),
      collaborations: full ? creatorCollaborations : undefined,
      price: price
        ? {
            amountMin: price.amount_min == null ? null : Number(price.amount_min),
            amountMax: price.amount_max == null ? null : Number(price.amount_max),
            currency: price.currency,
            unit: price.unit,
          }
        : null,
    }
  })
}

export async function loadCreator(db: Db, id: string, full: boolean) {
  const { rows } = await db.query('SELECT * FROM creators WHERE id = $1', [id])
  if (!rows[0]) return null
  return (await attachCreatorMeta(db, rows, full))[0]
}

function isoOrNull(value: unknown): string | null {
  if (value == null) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

export function parseMetrics(value: unknown): CreatorMetrics | null {
  if (!value) return null
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!parsed || typeof parsed !== 'object') return null
    return deriveMetrics({
      ...emptyMetrics((parsed as CreatorMetrics).window === 90 ? 90 : 30),
      ...(parsed as CreatorMetrics),
    })
  } catch {
    return null
  }
}

export function metricsFromRow(row: Record<string, any>): CreatorMetrics {
  const metrics = parseMetrics(row.metrics) ?? emptyMetrics()
  if (metrics.followers == null && row.followers != null) metrics.followers = Number(row.followers)
  if (metrics.priceImage == null && row.price?.amount_min != null) {
    metrics.priceImage = Number(row.price.amount_min)
  }
  return deriveMetrics(metrics)
}

export function enrichPoolItems(
  items: Array<Record<string, any>>,
  cohortItems: Array<Record<string, any>> = items,
): Array<Record<string, any>> {
  const byCohort = new Map<string, CreatorMetrics[]>()
  for (const item of cohortItems) {
    if (!item.source) continue
    const metrics = item.metrics as CreatorMetrics
    const tier = tierOf(metrics.followers)
    const key = cohortKey(item.source as SourceId, tier)
    byCohort.set(key, [...(byCohort.get(key) ?? []), metrics])
  }
  return items.map((item) => {
    const metrics = item.metrics as CreatorMetrics
    const tier = tierOf(metrics.followers)
    const key = item.source ? cohortKey(item.source as SourceId, tier) : null
    const cohort = key ? byCohort.get(key) ?? [] : []
    return {
      ...item,
      followers: metrics.followers,
      tier,
      cohort: item.source ? { source: item.source, tier, size: cohort.length } : null,
      metrics,
      percentiles: cohortPercentiles(metrics, cohort),
    }
  })
}

export function coerceSavedQuery(value: unknown, id?: string, version?: number): SavedQuery {
  const input = value && typeof value === 'object' ? value as Partial<SavedQuery> : {}
  return defaultSavedQuery({
    ...input,
    id: id ?? input.id ?? '',
    version: version ?? input.version ?? 1,
    name: typeof input.name === 'string' ? input.name : '',
  })
}

export function coerceSourceQuery(value: unknown, source: SourceId): SourceQuery {
  let parsed = value
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      parsed = null
    }
  }
  const input = parsed && typeof parsed === 'object' ? parsed as Partial<SourceQuery> : {}
  return { ...input, source, window: input.window === 90 ? 90 : 30 }
}

export function savedQueryFromRow(row: Record<string, any>): SavedQuery {
  const spec = coerceSavedQuery(row.spec, String(row.id), Number(row.version))
  spec.name = String(row.name)
  return spec
}

export function queryRow(item: Record<string, any>) {
  return {
    id: String(item.id),
    creatorKey: String(item.creatorKey),
    displayName: String(item.displayName),
    source: item.source as SourceId,
    regions: item.regions as string[],
    coopBrands: [...new Set([
      ...(item.metrics.coopBrands ?? []),
      ...(item.collabBrands ?? []),
    ])] as string[],
    metrics: item.metrics as CreatorMetrics,
  }
}

export function publicQueryResultRow(item: Record<string, any>) {
  return { ...item, health: item.metrics.health }
}

export function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export async function queryPool(db: Db, query: Record<string, string>) {
  const { rows } = await db.query("SELECT * FROM creators WHERE status = 'released'")
  const visible = (await attachCreatorMeta(db, rows, false))
    .filter((item) => !item.categories.includes('blacklist'))
    .map(asPublished)
  let items = enrichPoolItems(visible, visible)
  if (query.hasCollaborated === 'true') items = items.filter((item) => item.hasCollaborated)
  if (query.hasCollaborated === 'false') items = items.filter((item) => !item.hasCollaborated)
  if (query.priceMin || query.priceMax) {
    const min = query.priceMin ? Number(query.priceMin) : 0
    const max = query.priceMax ? Number(query.priceMax) : Number.MAX_SAFE_INTEGER
    items = items.filter((item) => {
      if (!item.price) return false
      const low = item.price.amountMin ?? item.price.amountMax ?? 0
      const high = item.price.amountMax ?? item.price.amountMin ?? low
      if (query.currency && item.price.currency !== query.currency) return false
      return low <= max && high >= min
    })
  }
  for (const field of ['categories', 'category', 'verticals'] as const) {
    if (!query[field]) continue
    const wanted = query[field].split(',')
    items = items.filter((item) => {
      if (field === 'categories') return wanted.some((value) => item.categories.includes(value))
      if (field === 'category') {
        return wanted.some((value) => item.categories.includes(value) || item.verticals.includes(value))
      }
      return wanted.some((value) => item.verticals.includes(value))
    })
  }
  if (query.collabCountMin) {
    items = items.filter((item) => item.collabCount >= Number(query.collabCountMin))
  }
  if (query.collabCountMax) {
    items = items.filter((item) => item.collabCount <= Number(query.collabCountMax))
  }
  for (const field of ['tier', 'health', 'source'] as const) {
    if (!query[field]) continue
    const wanted = query[field].split(',')
    items = items.filter((item) => {
      const value = field === 'health' ? item.metrics.health : item[field]
      return value != null && wanted.includes(value)
    })
  }
  if (query.region) {
    const wanted = query.region.split(',').map((value) => value.toLowerCase())
    items = items.filter((item) =>
      item.regions.some((region: string) =>
        wanted.some((value) => region.toLowerCase().includes(value))),
    )
  }
  if (query.brand) {
    const wanted = query.brand.split(',').map((value) => value.toLowerCase()).filter(Boolean)
    items = items.filter((item) => {
      const text = [
        ...(item.collabBrands || []),
        ...(item.verticals || []),
        item.displayName,
        ...(item.categories || []),
      ].join(' ').toLowerCase()
      return wanted.some((value) => text.includes(value))
    })
  }
  if (query.q) {
    const needle = query.q.toLowerCase()
    items = items.filter((item) =>
      [item.displayName, item.creatorKey, ...item.regions, ...item.verticals, ...item.collabBrands]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }
  for (const key of METRIC_KEYS) {
    const min = query[`${key}Min`]
    const max = query[`${key}Max`]
    if (min != null && min !== '') {
      items = items.filter((item) => item.metrics[key] != null && item.metrics[key] >= Number(min))
    }
    if (max != null && max !== '') {
      items = items.filter((item) => item.metrics[key] != null && item.metrics[key] <= Number(max))
    }
  }
  const sort = query.sort === 'followers' || METRIC_KEYS.includes(query.sort as NumericMetricKey)
    ? query.sort as NumericMetricKey
    : 'cpe'
  const order = (query.order ?? (sort === 'cpe' ? 'asc' : 'desc')) === 'asc' ? 1 : -1
  items.sort((a, b) => {
    const left = a.metrics[sort]
    const right = b.metrics[sort]
    if (left == null && right == null) return compareFollowersDesc(a, b)
    if (left == null) return 1
    if (right == null) return -1
    if (left !== right) return (left - right) * order
    return compareFollowersDesc(a, b)
  })
  return items
}

function compareFollowersDesc(left: Record<string, any>, right: Record<string, any>) {
  if (left.followers == null && right.followers == null) return 0
  if (left.followers == null) return 1
  if (right.followers == null) return -1
  return right.followers - left.followers
}
