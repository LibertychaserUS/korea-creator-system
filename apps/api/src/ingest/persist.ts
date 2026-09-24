import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import {
  deriveMetrics,
  emptyMetrics,
  toAmount,
  toCount,
  type CreatorMetrics,
  type NormalizedCreator,
  type RawRecord,
  type SourceAdapter,
  type SourceId,
  type SourcePage,
} from '@kcs/contract'
import { parseMetrics, saveRelations } from '../http/creators'
import type { AppEnv } from '../http/types'
import { creatorKeyFromRow, type SheetRow } from '../xlsx-sheet'
import { deadLetterRecord, failureOf } from './dead-letters'

/**
 * The only place a collected creator reaches `creators`. Every way in — a queue
 * page, a replayed dead letter, a workbook row — goes through
 * `upsertCreatorFromNormalized`, so they all agree on:
 *
 * - identity: (source, externalId) in `creator_sources` → `creator_key` →
 *   `xhs_id` (newest match); only when all three miss is a new draft created;
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
         metrics_fetched_at = $11, last_ingest_job_id = $12, updated_at = now()
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
      ],
    )
  } else {
    await client.query(
      `INSERT INTO creators (
         id, creator_key, display_name, status, needs_review, followers, followers_unknown,
         regions, verticals, xhs_id, metrics, metrics_window, source, external_id,
         metrics_fetched_at, last_ingest_job_id, note
       ) VALUES ($1,$2,$3,'draft',true,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
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
    await client.query(
      `INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        randomUUID(),
        creatorId,
        origin.source,
        origin.raw.externalId,
        incoming.fetchedAt,
        JSON.stringify(origin.raw.payload),
      ],
    )
    await client.query(
      `INSERT INTO creator_metrics_history
         (id, creator_id, source, "window", fetched_at, job_id, metrics)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [randomUUID(), creatorId, origin.source, metrics.window, incoming.fetchedAt, jobId, JSON.stringify(metrics)],
    )
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

async function findExisting(client: PoolClient, incoming: IncomingCreator) {
  const { origin } = incoming
  if (origin.kind === 'source') {
    const linked = await client.query(
      `SELECT c.id, c.metrics FROM creator_sources s JOIN creators c ON c.id = s.creator_id
        WHERE s.source = $1 AND s.external_id = $2`,
      [origin.source, origin.externalId],
    )
    if (linked.rows[0]) return linked.rows[0] as { id: string; metrics: unknown }
  }
  const byKey = await client.query('SELECT id, metrics FROM creators WHERE creator_key = $1', [incoming.creatorKey])
  if (byKey.rows[0]) return byKey.rows[0] as { id: string; metrics: unknown }
  if (!incoming.xhsId) return null
  const byXhs = await client.query(
    'SELECT id, metrics FROM creators WHERE xhs_id = $1 ORDER BY updated_at DESC LIMIT 1',
    [incoming.xhsId],
  )
  return (byXhs.rows[0] as { id: string; metrics: unknown } | undefined) ?? null
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
  const price = toAmount(row.price)
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
      xhsId: row.xhsId || null,
      regions: row.region ? [row.region] : [],
      verticals: [row.vertical, row.keywords, row.persona].filter(Boolean) as string[],
      metrics: deriveMetrics({ ...emptyMetrics(), followers: followers.value, priceImage: price.value }),
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
