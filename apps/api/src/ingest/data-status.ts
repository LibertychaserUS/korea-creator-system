import type { PoolClient } from 'pg'
import type { Paging } from '@kcs/contract'
import { audit } from '../http/audit'
import { pageRows } from '../http/lists'
import { recomputeGroups, republish, syncPublished } from '../http/published'
import type { AppEnv } from '../http/types'
import { logEvent } from '../log'
import { materialChanges } from './tiering'

/**
 * What the data itself says about a creator, for ops to act on (nothing here
 * changes `status` or deletes anything):
 *
 * - stale — no fetch for more than `DATA_STALE_DAYS` (30) days;
 * - platform missing — a refresh by id came back without this id
 *   `PLATFORM_MISSING_AFTER` (3) times in a row. The creator is flagged
 *   (`creators.platform_missing_at`) so the pool can leave them out, and waits
 *   for ops: "keep" clears the flag, "gone" confirms it. Being seen again on
 *   any later fetch clears it by itself;
 * - republishable — published numbers (`metrics_locked`) and the latest ones
 *   differ past the snapshot tolerances (the same test as "did it change" in
 *   the refresh model), so a re-publish would move the pool.
 */
export type DataStatusConfig = { staleDays: number; missingAfter: number }

export function dataStatusConfig(source: NodeJS.ProcessEnv = process.env): DataStatusConfig {
  const whole = (value: string | undefined, fallback: number) => {
    const n = Number(value)
    return value !== undefined && value !== '' && Number.isInteger(n) && n >= 1 ? n : fallback
  }
  return {
    staleDays: whole(source.DATA_STALE_DAYS, 30),
    missingAfter: whole(source.PLATFORM_MISSING_AFTER, 3),
  }
}

export const DATA_STATUS_KINDS = ['stale', 'missing', 'republish'] as const
export type DataStatusKind = (typeof DATA_STATUS_KINDS)[number]

/** Published numbers vs latest, stored so lists can filter on it. */
export function republishChanges(locked: unknown, latest: unknown): string[] | null {
  if (!locked || typeof locked !== 'object') return null
  return materialChanges(locked as Record<string, unknown>, (latest ?? {}) as Record<string, unknown>)
}

/** A fetch saw this (source, id): whatever was counted as missing is over. */
export async function markSeen(client: PoolClient, creatorId: string, source: string, externalId: string) {
  const cleared = await client.query(
    `UPDATE creator_sources SET miss_count = 0, missing_since = NULL, missing_at = NULL
      WHERE source = $1 AND external_id = $2 AND (miss_count > 0 OR missing_at IS NOT NULL)`,
    [source, externalId],
  )
  if (!cleared.rowCount) return
  const back = await client.query(
    `UPDATE creators SET platform_missing_at = NULL, platform_missing_confirmed_at = NULL
      WHERE id = $1 AND platform_missing_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM creator_sources WHERE creator_id = $1 AND missing_at IS NOT NULL)`,
    [creatorId],
  )
  if (back.rowCount) {
    const moved = await syncPublished(client, [creatorId])
    if (moved.size) await recomputeGroups(client, moved)
  }
}

/**
 * End of a refresh job that went through every page: ids asked for but not
 * returned count one more miss; at the threshold the link and its creator are
 * flagged. Demo-data runs never count.
 */
export async function recordRefreshMisses(
  env: AppEnv,
  source: string,
  requested: readonly string[],
  seen: readonly string[],
  jobId: string,
  config: DataStatusConfig = dataStatusConfig(),
) {
  const seenSet = new Set(seen.map(String))
  const missing = [...new Set(requested.map(String))].filter((id) => !seenSet.has(id))
  if (!missing.length) return { missed: 0, flagged: [] as string[] }
  const now = env.now()
  const { rows } = await env.db.query(
    `UPDATE creator_sources SET miss_count = miss_count + 1,
       missing_since = COALESCE(missing_since, $3),
       missing_at = CASE WHEN miss_count + 1 >= $4 THEN COALESCE(missing_at, $3) ELSE missing_at END
      WHERE source = $1 AND external_id = ANY($2::text[])
      RETURNING creator_id, external_id, miss_count, missing_at`,
    [source, missing, now, config.missingAfter],
  )
  const newly = rows.filter((row) => row.missing_at && new Date(row.missing_at).getTime() === now.getTime())
  const flagged: string[] = []
  for (const row of newly) {
    const updated = await env.db.query(
      'UPDATE creators SET platform_missing_at = $2 WHERE id = $1 AND platform_missing_at IS NULL RETURNING display_name',
      [row.creator_id, now],
    )
    if (!updated.rowCount) continue
    flagged.push(row.creator_id)
    await audit(
      env.db,
      null,
      'creator.platform_missing',
      'creator',
      row.creator_id,
      `${source}:${row.external_id} 连续 ${row.miss_count} 次刷新取不到（任务 ${jobId}）`,
    )
  }
  if (flagged.length) await republish(env.db, flagged)
  if (rows.length) logEvent('info', 'ingest.refresh_misses', { jobId, source, missed: rows.length, flagged: flagged.length })
  return { missed: rows.length, flagged }
}

/** Ops' answer to a missing flag. Neither answer deletes anything. */
export async function decideMissing(env: AppEnv, creatorId: string, decision: 'keep' | 'gone', actorId: string) {
  const { rows } = await env.db.query(
    'SELECT display_name, platform_missing_at FROM creators WHERE id = $1',
    [creatorId],
  )
  if (!rows[0]) return { found: false as const }
  if (!rows[0].platform_missing_at) return { found: true as const, flagged: false as const }
  if (decision === 'keep') {
    await env.db.query(
      'UPDATE creator_sources SET miss_count = 0, missing_since = NULL, missing_at = NULL WHERE creator_id = $1',
      [creatorId],
    )
    await env.db.query(
      'UPDATE creators SET platform_missing_at = NULL, platform_missing_confirmed_at = NULL WHERE id = $1',
      [creatorId],
    )
    await republish(env.db, [creatorId])
  } else {
    await env.db.query(
      'UPDATE creators SET platform_missing_confirmed_at = COALESCE(platform_missing_confirmed_at, $2) WHERE id = $1',
      [creatorId, env.now()],
    )
  }
  await audit(env.db, actorId, `creator.platform_missing_${decision}`, 'creator', creatorId, rows[0].display_name)
  return { found: true as const, flagged: true as const, status: await creatorDataStatus(env, creatorId) }
}

/** Daily: re-check every published snapshot against the latest numbers. */
export async function runDataStatus(env: AppEnv) {
  const { rows } = await env.db.query(
    'SELECT id, metrics, metrics_locked FROM creators WHERE metrics_locked IS NOT NULL',
  )
  const now = env.now()
  for (const row of rows) {
    await env.db.query(
      'UPDATE creators SET republish_changes = $2, republish_checked_at = $3 WHERE id = $1',
      [row.id, republishChanges(row.metrics_locked, row.metrics), now],
    )
  }
  return { checked: rows.length, ...(await dataStatusCounts(env)) }
}

function filterFor(kind: DataStatusKind, params: unknown[], config: DataStatusConfig, now: Date): string {
  if (kind === 'missing') return 'c.platform_missing_at IS NOT NULL'
  if (kind === 'stale') {
    params.push(now, config.staleDays)
    return `c.metrics_fetched_at IS NOT NULL
      AND c.metrics_fetched_at < $${params.length - 1}::timestamptz - make_interval(days => $${params.length}::int)`
  }
  return `c.metrics_locked IS NOT NULL AND cardinality(c.republish_changes) > 0
    AND c.republish_checked_at >= c.metrics_locked_at AND c.metrics_fetched_at > c.metrics_locked_at`
}

export async function dataStatusCounts(env: AppEnv, config: DataStatusConfig = dataStatusConfig()) {
  const counts: Record<DataStatusKind, number> = { stale: 0, missing: 0, republish: 0 }
  for (const kind of DATA_STATUS_KINDS) {
    const params: unknown[] = []
    const where = filterFor(kind, params, config, env.now())
    const { rows } = await env.db.query(`SELECT count(*)::int AS n FROM creators c WHERE ${where}`, params)
    counts[kind] = rows[0].n
  }
  return counts
}

export async function listDataStatus(
  env: AppEnv,
  kind: DataStatusKind,
  paging: Paging,
  config: DataStatusConfig = dataStatusConfig(),
) {
  const params: unknown[] = []
  const where = filterFor(kind, params, config, env.now())
  const order = kind === 'missing'
    ? 'c.platform_missing_at DESC, c.id'
    : kind === 'stale' ? 'c.metrics_fetched_at, c.id' : 'c.republish_checked_at DESC, c.id'
  const { rows, total } = await pageRows(env.db, { columns: 'c.id', from: `FROM creators c WHERE ${where}`, order }, params, paging)
  const items = await dataStatusFor(env, rows.map((row) => row.id as string), config)
  return { items, total, page: paging.page, pageSize: paging.pageSize, config }
}

export async function creatorDataStatus(env: AppEnv, creatorId: string, config: DataStatusConfig = dataStatusConfig()) {
  return (await dataStatusFor(env, [creatorId], config))[0] ?? null
}

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : value == null ? null : String(value))

/** The full picture for a set of creators, in the order given. */
export async function dataStatusFor(env: AppEnv, ids: readonly string[], config: DataStatusConfig = dataStatusConfig()) {
  if (!ids.length) return []
  const [creators, links] = await Promise.all([
    env.db.query(
      `SELECT id, display_name, status, metrics_fetched_at, metrics_locked_at, metrics, metrics_locked,
              platform_missing_at, platform_missing_confirmed_at, republish_changes, republish_checked_at
         FROM creators WHERE id = ANY($1::text[])`,
      [ids],
    ),
    env.db.query(
      `SELECT creator_id, source, external_id, last_seen_at, miss_count, missing_since, missing_at
         FROM creator_sources WHERE creator_id = ANY($1::text[]) ORDER BY source, external_id`,
      [ids],
    ),
  ])
  const now = env.now().getTime()
  const byId = new Map(creators.rows.map((row) => [row.id as string, row]))
  return ids.flatMap((id) => {
    const row = byId.get(id)
    if (!row) return []
    const fetchedAt = row.metrics_fetched_at ? new Date(row.metrics_fetched_at) : null
    const ageDays = fetchedAt ? (now - fetchedAt.getTime()) / 86_400_000 : null
    // Recomputed here so a detail view is right even before the daily re-check.
    const changes = row.metrics_locked ? republishChanges(row.metrics_locked, row.metrics) ?? [] : []
    const newer = Boolean(fetchedAt && row.metrics_locked_at && fetchedAt > new Date(row.metrics_locked_at))
    return [{
      creatorId: id,
      displayName: row.display_name as string,
      status: row.status as string,
      lastFetchedAt: iso(row.metrics_fetched_at),
      stale: ageDays != null && ageDays > config.staleDays,
      daysSinceFetch: ageDays == null ? null : Math.floor(ageDays),
      platformMissing: row.platform_missing_at
        ? { since: iso(row.platform_missing_at), confirmedAt: iso(row.platform_missing_confirmed_at) }
        : null,
      republishable: Boolean(row.metrics_locked) && newer && changes.length > 0,
      changedSincePublish: row.metrics_locked ? changes : null,
      publishedAt: iso(row.metrics_locked_at),
      sources: links.rows.filter((link) => link.creator_id === id).map((link) => ({
        source: link.source as string,
        externalId: link.external_id as string,
        lastSeenAt: iso(link.last_seen_at),
        missCount: Number(link.miss_count),
        missingSince: iso(link.missing_since),
        missingAt: iso(link.missing_at),
      })),
    }]
  })
}
