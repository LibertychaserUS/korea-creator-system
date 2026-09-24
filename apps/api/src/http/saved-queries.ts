/**
 * Saved-query history: every change to a query writes the row as it is after
 * the change into `saved_query_revisions` (migration 0024), under the new version.
 */
import type { SavedQuery, SavedQueryRevisionAction } from '@kcs/contract'
import type { Queryable } from '../db'

export async function writeRevision(
  db: Queryable,
  row: Record<string, any>,
  action: SavedQueryRevisionAction,
  editedBy: string | null,
): Promise<void> {
  await db.query(
    `INSERT INTO saved_query_revisions (query_id, version, action, name, visibility, spec, edited_by, edited_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())
     ON CONFLICT (query_id, version) DO NOTHING`,
    [row.id, row.version, action, row.name, row.visibility, JSON.stringify(row.spec), editedBy],
  )
}

/**
 * Seeded or imported queries: write the row and, when it is new or changed,
 * the matching revision (a changed spec gets the next version, never an old number).
 */
export async function upsertSavedQuery(db: Queryable, orgId: string, spec: SavedQuery, createdBy: string | null): Promise<void> {
  const { rows } = await db.query(
    `INSERT INTO saved_queries (id, org_id, name, version, spec, created_by, visibility)
     VALUES ($1,$2,$3,1,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, spec = EXCLUDED.spec, visibility = EXCLUDED.visibility,
       version = saved_queries.version + 1, archived_at = NULL, archived_by = NULL, updated_at = now()
       WHERE saved_queries.name IS DISTINCT FROM EXCLUDED.name OR saved_queries.spec IS DISTINCT FROM EXCLUDED.spec
          OR saved_queries.visibility IS DISTINCT FROM EXCLUDED.visibility OR saved_queries.archived_at IS NOT NULL
     RETURNING *, (xmax = 0) AS inserted`,
    [spec.id, orgId, spec.name, JSON.stringify(spec), createdBy, spec.visibility],
  )
  if (rows[0]) await writeRevision(db, rows[0], rows[0].inserted ? 'create' : 'update', createdBy)
}
