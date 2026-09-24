import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import {
  deriveMetrics,
  emptyMetrics,
  normalizeXhsId,
  toAmount,
  toCount,
  type CreatorMetrics,
  type NormalizedCreator,
  type RawRecord,
  type SourceAdapter,
  type SourceId,
  type SourcePage,
  type SourceSignals,
} from '@kcs/contract'
import { parseMetrics, saveRelations } from '../http/creators'
import type { AppEnv } from '../http/types'
import { creatorKeyFromRow, type SheetRow } from '../xlsx-sheet'
import { deadLetterRecord, failureOf } from './dead-letters'
import { refreshIntervalDays, refreshModelConfig } from './refresh-model'
import { materialChanges } from './tiering'

/**
 * The only place a collected creator reaches `creators`. Every way in — a queue
 * page, a replayed dead letter, a workbook row — goes through
 * `upsertCreatorFromNormalized`, so they all agree on:
 *
 * - identity: the 小红书号 (normalised, one creator per account) wins; without
 *   one, (source, externalId) in `creator_sources` → `creator_key`; only when
 *   all miss is a new draft created;
 * - what is written: latest numbers (`metrics`, `followers`, …) and
 *   `needs_review = true`. `status`, `metrics_locked` and `metrics_locked_at`
 *   (the publish snapshot) are never touched — only publish moves those;
 * - side records, only for data that came from a source: the
 *   (source, externalId) link, the untouched payload in `creator_raw`, and one
 *   `creator_metrics_history` row. A workbook is typed in by ops, not measured
 *   by a platform, so it leaves no history; the file itself stays in object
 *   storage under `batches/<jobId>/`;
 * - one transaction per creator: a failure leaves nothing half-written.
 */

export type IncomingCreator = {
  creatorKey: string
  displayName: string
  xhsId: string | null
  regions: string[]
  verticals: string[]
  metrics: CreatorMetrics
  signals: SourceSignals | null
  fetchedAt: string
  origin:
    | { kind: 'source'; source: SourceId; externalId: string; raw: RawRecord }
    | { kind: 'sheet'; note: string | null; price: number | null }
}

export type UpsertOutcome = { creatorId: string; created: boolean }

export type PersistCounts = { written: number; skipped: number; failed: number }

export async function upsertCreatorFromNormalized(
  env: AppEnv,
  jobId: string | null,
  incoming: IncomingCreator,
): Promise<UpsertOutcome> {
  const normalized = { ...incoming, xhsId: normalizeXhsId(incoming.xhsId) }
  try {
    return await upsertOnce(env, jobId, normalized)
  } catch (error) {
    // Two writers created the same 小红书号 at once: the second now finds the first.
    if ((error as { code?: string }).code !== '23505') throw error
    return upsertOnce(env, jobId, normalized)
  }
}

async function upsertOnce(env: AppEnv, jobId: string | null, incoming: IncomingCreator): Promise<UpsertOutcome> {
  const client = await env.db.connect() as PoolClient
  try {
    await client.query('BEGIN')
    const outcome = await upsertInTransaction(client, jobId, incoming)
    await client.query('COMMIT')
    return outcome
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

async function upsertInTransaction(
  client: PoolClient,
  jobId: string | null,
  incoming: IncomingCreator,
): Promise<UpsertOutcome> {
  const { origin } = incoming
  const existing = await findExisting(client, incoming)
  const creatorId = existing?.id ?? randomUUID()
  const metrics = origin.kind === 'sheet' && existing
    ? mergeSheetMetrics(parseMetrics(existing.metrics), incoming.metrics)
    : incoming.metrics
  const followers = metrics.followers
  const source = origin.kind === 'source' ? origin.source : null
  const externalId = origin.kind === 'source' ? origin.externalId : null

  if (existing) {
    // Sheet rows carry only what ops typed; blanks keep what is already known.
    await client.query(
      `UPDATE creators SET
         display_name = $2, needs_review = true,
         followers = COALESCE($3::integer, followers), followers_unknown = ($3::integer IS NULL AND followers IS NULL),
         regions = CASE WHEN cardinality($4::text[]) > 0 THEN $4 ELSE regions END,
         verticals = CASE WHEN cardinality($5::text[]) > 0 THEN $5 ELSE verticals END,
         xhs_id = COALESCE($6, xhs_id),
         metrics = $7, metrics_window = $8,
         source = COALESCE($9, source), external_id = COALESCE($10, external_id),
         metrics_fetched_at = $11, last_ingest_job_id = $12,
         source_signals = COALESCE($13::jsonb, source_signals), updated_at = now()
       WHERE id = $1`,
      [
        creatorId,
        incoming.displayName,
        followers,
        incoming.regions,
        incoming.verticals,
        incoming.xhsId,
        JSON.stringify(metrics),
        metrics.window,
        source,
        externalId,
        incoming.fetchedAt,
        jobId,
        incoming.signals ? JSON.stringify(incoming.signals) : null,
      ],
    )
  } else {
    await client.query(
      `INSERT INTO creators (
         id, creator_key, display_name, status, needs_review, followers, followers_unknown,
         regions, verticals, xhs_id, metrics, metrics_window, source, external_id,
         metrics_fetched_at, last_ingest_job_id, note, source_signals, first_ingest_job_id
       ) VALUES ($1,$2,$3,'draft',true,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$14)`,
      [
        creatorId,
        incoming.creatorKey,
        incoming.displayName,
        followers,
        followers == null,
        incoming.regions,
        incoming.verticals,
        incoming.xhsId,
        JSON.stringify(metrics),
        metrics.window,
        source,
        externalId,
        incoming.fetchedAt,
        jobId,
        origin.kind === 'sheet' ? origin.note : null,
        incoming.signals ? JSON.stringify(incoming.signals) : null,
      ],
    )
  }

  if (origin.kind === 'source') {
    await client.query(
      `INSERT INTO creator_sources
         (creator_id, source, external_id, first_seen_at, last_seen_at)
       VALUES ($1,$2,$3,$4,$4)
       ON CONFLICT (source, external_id) DO UPDATE SET
         creator_id = EXCLUDED.creator_id,
         last_seen_at = GREATEST(creator_sources.last_seen_at, EXCLUDED.last_seen_at)`,
      [creatorId, origin.source, origin.externalId, incoming.fetchedAt],
    )
    // Same body as an earlier fetch → stored once; this fetch still gets its own row.
    await client.query(
      `WITH body AS (SELECT $6::jsonb AS payload, sha256(convert_to($6::jsonb::text, 'UTF8')) AS hash),
            stored AS (
              INSERT INTO raw_payloads (hash, payload, bytes)
              SELECT hash, payload, octet_length(payload::text) FROM body
              ON CONFLICT (hash) DO NOTHING)
       INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload_hash)
       SELECT $1,$2,$3,$4,$5, hash FROM body`,
      [
        randomUUID(),
        creatorId,
        origin.source,
        origin.raw.externalId,
        incoming.fetchedAt,
        JSON.stringify(origin.raw.payload),
      ],
    )
    const previous = await client.query(
      `SELECT metrics, fetched_at FROM creator_metrics_history
        WHERE creator_id = $1 AND source = $2 AND fetched_at < $3
        ORDER BY fetched_at DESC LIMIT 1`,
      [creatorId, origin.source, incoming.fetchedAt],
    )
    const before = previous.rows[0] as { metrics: Record<string, unknown>; fetched_at: Date } | undefined
    const changed = before ? materialChanges(before.metrics, metrics as unknown as Record<string, unknown>) : null
    await client.query(
      `INSERT INTO creator_metrics_history
         (id, creator_id, source, "window", fetched_at, job_id, metrics, signals, material_change, changed_metrics)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        randomUUID(), creatorId, origin.source, metrics.window, incoming.fetchedAt, jobId, JSON.stringify(metrics),
        incoming.signals ? JSON.stringify(incoming.signals) : null,
        changed ? changed.length > 0 : null,
        changed,
      ],
    )
    await updateRefreshStats(client, origin.source, origin.externalId, incoming.fetchedAt, before?.fetched_at ?? null, changed)
  } else if (!existing) {
    // A hand-typed row starts life like a hand-made draft: unknown cooperation
    // history, the quoted price, and a pending proof-read.
    await client.query(
      "INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1,'never_collaborated')",
      [creatorId],
    )
    if (origin.price != null) {
      await saveRelations(client, creatorId, { price: { amountMin: origin.price, currency: 'CNY' } })
    }
    await client.query(
      `INSERT INTO reviews (id, creator_id, risk_level, conclusion, status)
       VALUES ($1,$2,'low','文件投递待校对','pending')`,
      [randomUUID(), creatorId],
    )
  }
  return { creatorId, created: !existing }
}

/**
 * One more observation for the Poisson change model of this (source, id):
 * compared with the previous snapshot, did the numbers move? Then the next
 * refresh is due after the interval that model gives (see `./refresh-model`).
 */
async function updateRefreshStats(
  client: PoolClient,
  source: SourceId,
  externalId: string,
  fetchedAt: string,
  previousAt: Date | null,
  changed: string[] | null,
) {
  const { rows } = await client.query(
    'SELECT refresh_visits, refresh_changes, observed_days FROM creator_sources WHERE source = $1 AND external_id = $2',
    [source, externalId],
  )
  if (!rows[0]) return
  const stats = {
    visits: Number(rows[0].refresh_visits),
    changes: Number(rows[0].refresh_changes),
    observedDays: Number(rows[0].observed_days),
  }
  if (previousAt && changed) {
    const gap = (new Date(fetchedAt).getTime() - new Date(previousAt).getTime()) / 86_400_000
    if (gap > 0) {
      stats.visits += 1
      stats.changes += changed.length ? 1 : 0
      stats.observedDays += gap
    }
  }
  const { rate, days } = refreshIntervalDays(stats, refreshModelConfig())
  await client.query(
    `UPDATE creator_sources SET refresh_visits = $3, refresh_changes = $4, observed_days = $5,
       change_rate = $6, refresh_interval_days = $7,
       next_refresh_at = $8::timestamptz + make_interval(secs => $7::float8 * 86400)
     WHERE source = $1 AND external_id = $2`,
    [source, externalId, stats.visits, stats.changes, stats.observedDays, rate, days, fetchedAt],
  )
}

type Existing = { id: string; metrics: unknown }

/**
 * A 小红书号 names one account, so its owner wins over a vendor-id link or a
 * key: a record that learns its 小红书号 joins the creator already holding it
 * (the link moves over; the earlier creator keeps its raw and history).
 */
async function findExisting(client: PoolClient, incoming: IncomingCreator): Promise<Existing | null> {
  const { origin } = incoming
  if (incoming.xhsId) {
    const byXhs = await client.query('SELECT id, metrics FROM creators WHERE xhs_id = $1', [incoming.xhsId])
    if (byXhs.rows[0]) return byXhs.rows[0] as Existing
  }
  if (origin.kind === 'source') {
    const linked = await client.query(
      `SELECT c.id, c.metrics FROM creator_sources s JOIN creators c ON c.id = s.creator_id
        WHERE s.source = $1 AND s.external_id = $2`,
      [origin.source, origin.externalId],
    )
    if (linked.rows[0]) return linked.rows[0] as Existing
  }
  const byKey = await client.query('SELECT id, metrics FROM creators WHERE creator_key = $1', [incoming.creatorKey])
  return (byKey.rows[0] as Existing | undefined) ?? null
}

/** A sheet only knows followers and the image-note quote; everything else stays. */
function mergeSheetMetrics(current: CreatorMetrics | null, sheet: CreatorMetrics): CreatorMetrics {
  if (!current) return sheet
  return deriveMetrics({
    ...current,
    followers: sheet.followers ?? current.followers,
    priceImage: sheet.priceImage ?? current.priceImage,
  })
}

export function incomingFromSource(
  source: SourceId,
  creator: NormalizedCreator,
  raw: RawRecord,
): IncomingCreator {
  return {
    creatorKey: creator.creatorKey,
    displayName: creator.displayName,
    xhsId: creator.xhsId,
    regions: creator.regions,
    verticals: creator.verticals,
    metrics: creator.metrics,
    signals: creator.signals ?? null,
    fetchedAt: raw.fetchedAt,
    origin: { kind: 'source', source, externalId: creator.externalId, raw },
  }
}

export type SheetRowResult = { ok: true; incoming: IncomingCreator } | { ok: false; errors: string[] }

/**
 * A typed-in row. Numbers go through the same parser as vendor data; a cell
 * that is there but is not one number ("5000-8000", "约1万") makes the row
 * invalid instead of turning into a wrong value. "暂无" / "-" just mean unknown.
 */
export function readSheetRow(row: SheetRow, now: Date): SheetRowResult {
  const displayName = row.displayName || row.xhsId || row.userId
  if (!displayName) return { ok: false, errors: ['displayName.missing'] }
  const followers = toCount(row.followers)
  const parsedPrice = toAmount(row.price)
  // A 0 quote in a sheet means "not quoted", same as a vendor's 0.
  const price = parsedPrice.value === 0 ? { value: null, issue: null } : parsedPrice
  const errors = [
    ['followers', followers.issue],
    ['price', price.issue],
  ]
    .filter(([, issue]) => issue && issue !== 'placeholder' && issue !== 'lowerBound')
    .map(([field, issue]) => `${field}.${issue}`)
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    incoming: {
      creatorKey: creatorKeyFromRow(row) || `ck_${randomUUID()}`,
      displayName,
      xhsId: normalizeXhsId(row.xhsId),
      regions: row.region ? [row.region] : [],
      verticals: [row.vertical, row.keywords, row.persona].filter(Boolean) as string[],
      metrics: deriveMetrics({ ...emptyMetrics(), followers: followers.value, priceImage: price.value }),
      signals: null,
      fetchedAt: now.toISOString(),
      origin: { kind: 'sheet', note: row.persona || null, price: price.value },
    },
  }
}

/** `null` when the row cannot be read (see `readSheetRow` for why). */
export function incomingFromSheet(row: SheetRow, now: Date): IncomingCreator | null {
  const result = readSheetRow(row, now)
  return result.ok ? result.incoming : null
}

/**
 * One vendor page. A record that cannot be read or written is parked in the
 * dead-letter list with its original JSON (a field map usually needs one fix)
 * instead of being counted and dropped.
 */
export async function persistPage(
  env: AppEnv,
  adapter: SourceAdapter,
  page: SourcePage,
  jobId: string | null,
  source: SourceId,
): Promise<PersistCounts> {
  const counts: PersistCounts = { written: 0, skipped: 0, failed: 0 }
  for (const raw of page.records) {
    const normalized = adapter.normalize(raw)
    if (!normalized.ok) {
      counts.failed += 1
      await deadLetterRecord(env, {
        jobId,
        source,
        raw,
        code: 'RECORD_INVALID',
        message: normalized.errors.join('; ') || 'record could not be read',
      })
      continue
    }
    try {
      const outcome = await upsertCreatorFromNormalized(env, jobId, incomingFromSource(source, normalized.creator, raw))
      if (outcome.created) counts.written += 1
      else counts.skipped += 1
    } catch (error) {
      counts.failed += 1
      await deadLetterRecord(env, {
        jobId,
        source,
        raw,
        code: 'RECORD_WRITE_FAILED',
        message: failureOf(error).message,
      }).catch(() => undefined)
    }
  }
  return counts
}
