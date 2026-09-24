import type { Queryable } from '../db'

/**
 * What happened to a creator after we collected them: published, assigned to a
 * project, removed, exported, looked at. Used for value tiers (which snapshots
 * a decision rested on) and for the scheduler's rewards. Never for ranking.
 *
 * The events table belongs to the pool side (line A). Agreed shape:
 *
 *   creator_outcome_events(id text, creator_id text, kind text, occurred_at timestamptz, …)
 *   kind ∈ publish | assign | remove | export | view
 *
 * Until that table exists, the same facts are read from what is already stored
 * (publish time, assignments, shortlist, unpublish audit); `export` and `view`
 * have no record there and stay empty.
 */
export const OUTCOME_KINDS = ['publish', 'assign', 'shortlist', 'remove', 'export', 'view'] as const
export type OutcomeKind = (typeof OUTCOME_KINDS)[number]
export type OutcomeEvent = { creatorId: string; kind: OutcomeKind; at: Date }

export const OUTCOME_EVENTS_TABLE = 'creator_outcome_events'

export async function hasOutcomeEventsTable(db: Queryable): Promise<boolean> {
  const { rows } = await db.query('SELECT to_regclass($1) IS NOT NULL AS ok', [OUTCOME_EVENTS_TABLE])
  return Boolean(rows[0]?.ok)
}

export type OutcomeFilter = { creatorIds?: string[]; since?: Date }

export async function outcomeEvents(db: Queryable, filter: OutcomeFilter = {}): Promise<OutcomeEvent[]> {
  const ids = filter.creatorIds ?? null
  const since = filter.since ?? new Date(0)
  const toEvents = (rows: { creator_id: string; kind: string; at: Date | string }[]) =>
    rows
      .filter((row) => (OUTCOME_KINDS as readonly string[]).includes(row.kind))
      .map((row) => ({ creatorId: row.creator_id, kind: row.kind as OutcomeKind, at: new Date(row.at) }))

  if (await hasOutcomeEventsTable(db)) {
    const { rows } = await db.query(
      `SELECT creator_id, kind, occurred_at AS at FROM ${OUTCOME_EVENTS_TABLE}
        WHERE occurred_at >= $2 AND ($1::text[] IS NULL OR creator_id = ANY($1::text[]))`,
      [ids, since],
    )
    return toEvents(rows)
  }
  const { rows } = await db.query(
    `SELECT id AS creator_id, 'publish' AS kind, metrics_locked_at AS at FROM creators
      WHERE metrics_locked_at IS NOT NULL AND metrics_locked_at >= $2 AND ($1::text[] IS NULL OR id = ANY($1::text[]))
     UNION ALL
     SELECT r.creator_id, 'publish', a.created_at FROM audit_logs a JOIN reviews r ON r.id = a.entity_id
      WHERE a.entity_type = 'review' AND a.action = 'review.pass' AND a.created_at >= $2
        AND ($1::text[] IS NULL OR r.creator_id = ANY($1::text[]))
     UNION ALL
     SELECT entity_id, 'remove', created_at FROM audit_logs
      WHERE entity_type = 'creator' AND action = 'creator.unpublish' AND created_at >= $2
        AND ($1::text[] IS NULL OR entity_id = ANY($1::text[]))
     UNION ALL
     SELECT creator_id, 'assign', assigned_at FROM assignments
      WHERE assigned_at >= $2 AND ($1::text[] IS NULL OR creator_id = ANY($1::text[]))
     UNION ALL
     SELECT creator_id, 'shortlist', added_at FROM shortlist_items
      WHERE added_at >= $2 AND ($1::text[] IS NULL OR creator_id = ANY($1::text[]))`,
    [ids, since],
  )
  return toEvents(rows)
}
