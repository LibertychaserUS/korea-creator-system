import {
  creatorStage,
  defaultSavedQuery,
  deriveMetrics,
  normalizeMetrics,
  normalizeSavedQuery,
  currencyExponent,
  normalizeCurrency,
  priceInCny,
  toMinorUnits,
  type CreatorMetrics,
  type IngestJobView,
  type SavedQuery,
  type SourceId,
  type SourceQuery,
} from '@kcs/contract'
import type { Db, Queryable } from '../db'

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

/** What a selector may see: released, not blacklisted, not flagged 「平台上已找不到」. */
export function inSelectPool(item: Record<string, any> | null | undefined): boolean {
  return Boolean(item && item.status === 'released' && !item.categories.includes('blacklist') && item.platformMissingAt == null)
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
    /** When the published (locked) numbers were fetched; the 60-day staleness runs from here. */
    snapshotFetchedAt: item.snapshotFetchedAt ?? null,
    tier: item.tier,
    cohort: item.cohort,
    metrics: item.metrics,
    percentiles: item.percentiles,
    health: item.metrics.health,
    metricsLocked: item.metricsLocked,
    metricsLockedAt: item.metricsLockedAt,
    /** Snapshot older than 60 days: still listed, no percentiles. */
    stale: Boolean(item.stale),
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

export function camelJobs(rows: Array<Record<string, any>>): IngestJobView[] {
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

export async function saveRelations(db: Queryable, creatorId: string, body: Record<string, any>) {
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
      amountMin?: number | null
      amountMax?: number | null
      currency?: string
      unit?: string
      fxToCny?: number | null
    }
    const code = normalizeCurrency(price.currency ?? 'CNY') ?? 'CNY'
    const fx = code === 'CNY' ? null : price.fxToCny ?? null
    await db.query('DELETE FROM prices WHERE creator_id = $1', [creatorId])
    await db.query(
      `INSERT INTO prices (id, creator_id, amount_min_minor, amount_max_minor, currency, unit, fx_to_cny, fx_recorded_at)
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,CASE WHEN $6::numeric IS NULL THEN NULL ELSE now() END)`,
      [
        creatorId,
        toMinorUnits(price.amountMin, code),
        toMinorUnits(price.amountMax, code),
        code,
        price.unit ?? 'per_post',
        fx,
      ],
    )
  }
}

/** A `date` column comes back as local midnight; send the calendar day, not a shifted instant. */
function dateOnly(value: unknown): string | null {
  if (!(value instanceof Date)) return (value as string | null) ?? null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

/** One record per Beijing day and source (`snapshot_day`: the day's last fetch), oldest first. */
export async function creatorHistory(
  db: Db,
  creatorId: string,
  query: Record<string, string | undefined>,
) {
  const window = query.window === '90' ? 90 : 30
  const limit = Math.max(1, Math.min(200, Number(query.limit || 60)))
  const { rows } = await db.query(
    `SELECT id, creator_id, source, "window", fetched_at, job_id, metrics
       FROM creator_metrics_history
      WHERE creator_id = $1 AND "window" = $2
      ORDER BY snapshot_day DESC, source
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
  db: Queryable,
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
    const quote = price ? priceView(price) : null
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
      metricsLocked: parseMetrics(row.metrics_locked, row.source),
      metricsLockedAt: isoOrNull(row.metrics_locked_at),
      snapshotFetchedAt: isoOrNull(row.metrics_locked_fetched_at ?? row.metrics_locked_at),
      stage: creatorStage({ status: row.status, metricsLockedAt: row.metrics_locked_at }),
      metricsFetchedAt: row.metrics_fetched_at ?? null,
      platformMissingAt: row.platform_missing_at ?? null,
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
      collaborations: full
        ? creatorCollaborations.map((item) => ({
            id: item.id,
            brand: item.brand,
            happenedAt: dateOnly(item.happened_at),
            note: item.note ?? null,
          }))
        : undefined,
      price: quote,
    }
  })
}

export async function loadCreator(db: Queryable, id: string, full: boolean) {
  const { rows } = await db.query('SELECT * FROM creators WHERE id = $1', [id])
  if (!rows[0]) return null
  return (await attachCreatorMeta(db, rows, full))[0]
}

function isoOrNull(value: unknown): string | null {
  if (value == null) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

/** A stored record in today's shape (see `normalizeMetrics`); `source` decides legacy meanings. */
export function parseMetrics(value: unknown, source?: string | null): CreatorMetrics | null {
  if (!value) return null
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!parsed || typeof parsed !== 'object') return null
    return normalizeMetrics(parsed, source)
  } catch {
    return null
  }
}

/** A `prices` row as the API shows it: major units, upper-case currency, the rate if one was recorded. */
export function priceView(row: Record<string, any>) {
  return {
    amountMin: minorToMajor(row.amount_min_minor, row.currency),
    amountMax: minorToMajor(row.amount_max_minor, row.currency),
    currency: String(row.currency),
    unit: row.unit,
    fxToCny: row.fx_to_cny == null ? null : Number(row.fx_to_cny),
  }
}

function minorToMajor(value: unknown, currency: string): number | null {
  if (value == null) return null
  return Number(value) / 10 ** currencyExponent(currency)
}

/**
 * Latest numbers with the row's followers and manual quote folded in. A quote
 * only becomes `priceImage` in 人民币: CNY as is, another currency only with the
 * rate recorded next to it — otherwise cost ratios stay empty rather than
 * treating 500 万韩元 as 500 万元.
 */
export function metricsFromRow(row: Record<string, any>): CreatorMetrics {
  const metrics = parseMetrics(row.metrics, row.source) ?? normalizeMetrics({}, row.source)
  if (metrics.followers == null && row.followers != null) metrics.followers = Number(row.followers)
  if (metrics.priceImage == null && row.price) {
    const quote = priceView(row.price)
    const amount = quote.amountMin ?? quote.amountMax
    const cny = priceInCny(amount, quote.currency, quote.fxToCny)
    if (cny != null) {
      metrics.priceImage = cny
      metrics.priceQuote = { amount: amount!, currency: quote.currency, fxToCny: quote.currency === 'CNY' ? 1 : quote.fxToCny }
    }
  }
  return deriveMetrics(metrics)
}

/**
 * A posted or stored spec as a full `SavedQuery`. Accepts the flat shape and
 * the `{ name, spec: {...} }` wrapper older select pages sent (whose rows keep
 * the real spec nested under `spec`).
 */
export function coerceSavedQuery(value: unknown, id?: string, version?: number): SavedQuery {
  const normalized = normalizeSavedQuery(unwrapSavedQuery(value)) as Record<string, unknown>
  // Only spec fields are kept: list metadata (mine, ownerName …) posted back is dropped.
  const input = Object.fromEntries(SAVED_QUERY_FIELDS.filter((key) => normalized[key] !== undefined).map((key) => [key, normalized[key]])) as Partial<SavedQuery>
  return defaultSavedQuery({
    ...input,
    id: id ?? input.id ?? '',
    version: version ?? input.version ?? 1,
    name: typeof input.name === 'string' ? input.name : '',
  })
}

const SAVED_QUERY_FIELDS = Object.keys(defaultSavedQuery())

export function unwrapSavedQuery(value: unknown): Record<string, any> {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {}
  if (!raw.spec || typeof raw.spec !== 'object' || Array.isArray(raw.spec)) return raw
  const { spec, ...outer } = raw
  return { ...coerceNested(spec), ...pickDefined(outer, ['name', 'visibility', 'version']) }
}

function coerceNested(spec: Record<string, any>): Record<string, any> {
  return spec.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec) ? coerceNested(spec.spec) : spec
}

function pickDefined(value: Record<string, any>, keys: string[]): Record<string, any> {
  return Object.fromEntries(keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]))
}

export function savedQueryFromRow(row: Record<string, any>): SavedQuery {
  const spec = coerceSavedQuery(row.spec, String(row.id), Number(row.version))
  spec.name = String(row.name)
  if (row.visibility === 'private' || row.visibility === 'team') spec.visibility = row.visibility
  return spec
}
