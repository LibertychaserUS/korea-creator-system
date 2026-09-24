/**
 * Writing and reading `creator_events` (contract `events.ts`). Callers that
 * change state write their event inside the same transaction; a detail view is
 * best effort and never fails the page.
 */
import { DETAIL_VIEW_DEDUPE_MINUTES, type CreatorEvent, type CreatorEventKind } from '@kcs/contract'
import type { Queryable } from '../db'

export type NewCreatorEvent = {
  kind: CreatorEventKind
  creatorId: string
  orgId?: string | null
  actorId?: string | null
  projectId?: string | null
  context?: Record<string, unknown>
}

/** Appends events; returns how many were written (repeat detail views inside the dedupe window are skipped). */
export async function recordEvents(db: Queryable, events: NewCreatorEvent[]): Promise<number> {
  if (!events.length) return 0
  const rows = events.map((e) => ({
    kind: e.kind,
    creator_id: e.creatorId,
    org_id: e.orgId ?? null,
    actor_id: e.actorId ?? null,
    project_id: e.projectId ?? null,
    context: e.context ?? {},
  }))
  const result = await db.query(
    `INSERT INTO creator_events (kind, creator_id, org_id, actor_id, project_id, source, context)
     SELECT e.kind, e.creator_id, e.org_id, e.actor_id, e.project_id, c.source, e.context
       FROM jsonb_to_recordset($1::jsonb)
            AS e(kind text, creator_id text, org_id text, actor_id text, project_id text, context jsonb)
       LEFT JOIN creators c ON c.id = e.creator_id
      WHERE e.kind <> 'detail_view' OR NOT EXISTS (
        SELECT 1 FROM creator_events x
         WHERE x.kind = 'detail_view' AND x.creator_id = e.creator_id
           AND x.actor_id IS NOT DISTINCT FROM e.actor_id
           AND x.occurred_at > now() - make_interval(mins => $2::int))`,
    [JSON.stringify(rows), DETAIL_VIEW_DEDUPE_MINUTES],
  )
  return result.rowCount ?? 0
}

/** Events newest first, optionally narrowed by creators, kinds and time. */
export async function readEvents(
  db: Queryable,
  filter: { creatorIds?: string[]; kinds?: CreatorEventKind[]; since?: Date; limit?: number } = {},
): Promise<CreatorEvent[]> {
  const where: string[] = []
  const values: unknown[] = []
  if (filter.creatorIds) where.push(`creator_id = ANY($${values.push(filter.creatorIds)})`)
  if (filter.kinds) where.push(`kind = ANY($${values.push(filter.kinds)})`)
  if (filter.since) where.push(`occurred_at >= $${values.push(filter.since)}`)
  const { rows } = await db.query(
    `SELECT * FROM creator_events ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY occurred_at DESC, id DESC LIMIT $${values.push(Math.min(Math.max(filter.limit ?? 1000, 1), 10_000))}`,
    values,
  )
  return rows.map((row) => ({
    id: String(row.id),
    kind: row.kind,
    creatorId: row.creator_id,
    orgId: row.org_id ?? null,
    actorId: row.actor_id ?? null,
    projectId: row.project_id ?? null,
    source: row.source ?? null,
    context: row.context ?? {},
    occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at),
  }))
}
