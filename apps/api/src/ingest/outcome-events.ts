import type { CreatorEventKind } from '@kcs/contract'
import type { Queryable } from '../db'

/**
 * What happened to a creator after we collected them: published, assigned to a
 * project, removed, exported, looked at. Used for value tiers (which snapshots
 * a decision rested on) and for the scheduler's rewards. Never for ranking.
 *
 * Source of truth is the pool side's append-only `creator_events` (0025). Two
 * facts it does not carry are read from their own tables: being put on a
 * shortlist (`shortlist_items`), and publishes that happened before the events
 * table existed (`creators.metrics_locked_at` with no publish event).
 */
export const OUTCOME_KINDS = ['publish', 'assign', 'shortlist', 'remove', 'export', 'view'] as const
export type OutcomeKind = (typeof OUTCOME_KINDS)[number]
export type OutcomeEvent = { creatorId: string; kind: OutcomeKind; at: Date }

export const OUTCOME_KIND_OF_EVENT: Record<CreatorEventKind, OutcomeKind> = {
  publish: 'publish',
  unpublish: 'remove',
  assign: 'assign',
  unassign: 'remove',
  export: 'export',
  detail_view: 'view',
}

export type OutcomeFilter = { creatorIds?: string[]; since?: Date }

export async function outcomeEvents(db: Queryable, filter: OutcomeFilter = {}): Promise<OutcomeEvent[]> {
  const ids = filter.creatorIds ?? null
  const since = filter.since ?? new Date(0)
  const { rows } = await db.query(
    `SELECT creator_id, kind, occurred_at AS at FROM creator_events
      WHERE occurred_at >= $2 AND ($1::text[] IS NULL OR creator_id = ANY($1::text[]))
     UNION ALL
     SELECT creator_id, 'shortlist', added_at FROM shortlist_items
      WHERE added_at >= $2 AND ($1::text[] IS NULL OR creator_id = ANY($1::text[]))
     UNION ALL
     SELECT c.id, 'publish', c.metrics_locked_at FROM creators c
      WHERE c.metrics_locked_at IS NOT NULL AND c.metrics_locked_at >= $2
        AND ($1::text[] IS NULL OR c.id = ANY($1::text[]))
        AND NOT EXISTS (SELECT 1 FROM creator_events e WHERE e.creator_id = c.id AND e.kind = 'publish')`,
    [ids, since],
  )
  return rows.flatMap((row: { creator_id: string; kind: string; at: Date | string }) => {
    const kind = (OUTCOME_KINDS as readonly string[]).includes(row.kind)
      ? (row.kind as OutcomeKind)
      : OUTCOME_KIND_OF_EVENT[row.kind as CreatorEventKind]
    return kind ? [{ creatorId: row.creator_id, kind, at: new Date(row.at) }] : []
  })
}
