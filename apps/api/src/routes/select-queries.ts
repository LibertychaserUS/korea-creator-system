import { randomUUID } from 'node:crypto'
import {
  validateSavedQuery,
  type SavedQueryRecord,
  type SavedQueryRevision,
} from '@kcs/contract'
import { coerceSavedQuery, savedQueryFromRow, unwrapSavedQuery } from '../http/creators'
import { savedQueryPage } from '../http/pool'
import { inTransaction } from '../http/published'
import type { Context } from 'hono'
import { z } from 'zod'
import { readJson, validationError } from '../http/body'
import { CursorError } from '../http/cursor'
import { jsonError } from '../http/responses'
import type { Queryable } from '../db'
import { writeRevision } from '../http/saved-queries'
import type { AppEnv, KcsApp, RouteHelpers, SessionUser } from '../http/types'

// `errors` stays as i18n keys (kcs.query.errors.*) for the select page.
function invalidQuery(context: Context, errors: string[]) {
  return context.json({
    error: {
      code: 'VALIDATION',
      message: 'invalid_query',
      fields: errors.map((key) => ({ path: key.split('.')[0], message: key })),
    },
    errors,
  }, 400)
}

function iso(value: unknown): string | null {
  if (value == null) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

/**
 * Queries a user may see: global ones, their org's team queries and their own
 * private ones. Someone else's private query is simply not there (404).
 */
const VISIBLE = `(q.org_id IS NULL OR q.org_id = $1) AND (q.visibility = 'team' OR q.created_by = $2)`

const RECORD_SELECT = `SELECT q.*, owner.display_name AS owner_name, editor.display_name AS updated_by_name
  FROM saved_queries q
  LEFT JOIN users owner ON owner.id = q.created_by
  LEFT JOIN users editor ON editor.id = COALESCE(q.updated_by, q.created_by)`

function recordFromRow(row: Record<string, any>, user: SessionUser): SavedQueryRecord {
  return {
    ...savedQueryFromRow(row),
    mine: row.created_by != null && row.created_by === user.id,
    ownerId: row.created_by ?? null,
    ownerName: row.owner_name ?? null,
    updatedAt: iso(row.updated_at),
    updatedByName: row.updated_by_name ?? null,
    archivedAt: iso(row.archived_at),
  }
}

async function loadRecord(db: Queryable, id: string, user: SessionUser): Promise<SavedQueryRecord | null> {
  const { rows } = await db.query(`${RECORD_SELECT} WHERE q.id = $3 AND ${VISIBLE}`, [user.orgId, user.id, id])
  return rows[0] ? recordFromRow(rows[0], user) : null
}

function queryId(context: Context): string {
  return context.req.param('id') ?? ''
}

export function registerSelectQueryRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  /**
   * `scope=mine` (the caller's own, private or team), `scope=team` (team
   * queries), default both. `archived=true` lists deleted ones instead, for
   * restoring.
   */
  app.get('/api/select/queries', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const scope = context.req.query('scope')
    const archived = context.req.query('archived') === 'true'
    const where = [VISIBLE, archived ? 'q.archived_at IS NOT NULL' : 'q.archived_at IS NULL']
    if (scope === 'mine') where.push('q.created_by = $2')
    if (scope === 'team') where.push(`q.visibility = 'team'`)
    const { rows } = await env.db.query(
      `${RECORD_SELECT} WHERE ${where.join(' AND ')} ORDER BY q.updated_at DESC, q.id`,
      [user!.orgId, user!.id],
    )
    return context.json({ items: rows.map((row) => recordFromRow(row, user!)) })
  })

  app.post('/api/select/queries/run', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const { data: raw, invalid } = await readJson(context, z.unknown())
    if (invalid) return invalid
    const spec = coerceSavedQuery(raw)
    const errors = validateSavedQuery(spec)
    if (errors.length) return invalidQuery(context, errors)
    try {
      return context.json(await savedQueryPage(env.db, spec, context.req.query()))
    } catch (err) {
      if (err instanceof CursorError) return validationError(context, err.code, [{ path: 'cursor', message: err.code }])
      throw err
    }
  })

  app.post('/api/select/queries', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const id = randomUUID()
    const { data: raw, invalid } = await readJson(context, z.unknown())
    if (invalid) return invalid
    const spec = coerceSavedQuery(raw, id, 1)
    const errors = validateSavedQuery(spec)
    if (errors.length) return invalidQuery(context, errors)
    await inTransaction(env.db, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO saved_queries (id, org_id, name, version, spec, created_by, updated_by, visibility)
         VALUES ($1,$2,$3,1,$4,$5,$5,$6) RETURNING *`,
        [id, user!.orgId, spec.name, JSON.stringify(spec), user!.id, spec.visibility],
      )
      await writeRevision(client, rows[0], 'create', user!.id)
    })
    return context.json(await loadRecord(env.db, id, user!), 201)
  })

  app.get('/api/select/queries/:id', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const record = await loadRecord(env.db, queryId(context), user!)
    if (!record) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json(record)
  })

  app.get('/api/select/queries/:id/revisions', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const record = await loadRecord(env.db, queryId(context), user!)
    if (!record) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    const { rows } = await env.db.query(
      `SELECT r.*, u.display_name AS edited_by_name
         FROM saved_query_revisions r LEFT JOIN users u ON u.id = r.edited_by
        WHERE r.query_id = $1 ORDER BY r.version DESC`,
      [record.id],
    )
    const items: SavedQueryRevision[] = rows.map((row) => ({
      version: Number(row.version),
      action: row.action,
      name: String(row.name),
      visibility: row.visibility,
      spec: savedQueryFromRow({ id: row.query_id, version: row.version, name: row.name, visibility: row.visibility, spec: row.spec }),
      editedBy: row.edited_by ?? null,
      editedByName: row.edited_by_name ?? null,
      editedAt: iso(row.edited_at)!,
    }))
    return context.json({ items })
  })

  /**
   * Partial update (or the whole spec, flat or as `{ name, spec }`). Sending
   * `version` makes it conditional: a query someone saved in the meantime is a
   * 409 instead of a silent overwrite. Only the author may change visibility.
   */
  app.patch('/api/select/queries/:id', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const { data: body, invalid } = await readJson(context, z.record(z.string(), z.unknown()))
    if (invalid) return invalid
    const patch = unwrapSavedQuery(body)
    const outcome = await inTransaction(env.db, async (client) => {
      const found = await client.query(
        `SELECT q.* FROM saved_queries q WHERE q.id = $3 AND q.org_id = $1 AND q.archived_at IS NULL AND ${VISIBLE} FOR UPDATE`,
        [user!.orgId, user!.id, queryId(context)],
      )
      const row = found.rows[0]
      if (!row) return { status: 404 as const }
      const current = savedQueryFromRow(row)
      if (typeof patch.version === 'number' && patch.version !== current.version) return { status: 409 as const, current }
      const spec = coerceSavedQuery({ ...current, ...patch }, current.id, current.version + 1)
      const errors = validateSavedQuery(spec)
      if (errors.length) return { status: 400 as const, errors }
      if (spec.visibility !== current.visibility && row.created_by !== user!.id) return { status: 403 as const }
      const same = JSON.stringify({ ...spec, version: current.version }) === JSON.stringify(current)
      if (same) return { status: 200 as const }
      const { rows } = await client.query(
        `UPDATE saved_queries SET name = $2, version = $3, spec = $4, visibility = $5, updated_by = $6, updated_at = now()
          WHERE id = $1 RETURNING *`,
        [current.id, spec.name, spec.version, JSON.stringify(spec), spec.visibility, user!.id],
      )
      await writeRevision(client, rows[0], 'update', user!.id)
      return { status: 200 as const }
    })
    if (outcome.status === 404) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    if (outcome.status === 400) return invalidQuery(context, outcome.errors)
    if (outcome.status === 403) return jsonError(context, 403, 'FORBIDDEN', 'owner_only')
    if (outcome.status === 409) {
      return context.json({ error: { code: 'CONFLICT', message: 'version_conflict' }, current: outcome.current }, 409)
    }
    return context.json(await loadRecord(env.db, queryId(context), user!))
  })

  /** Delete = archive: the query leaves the lists but it and its history are kept (restore below). */
  app.delete('/api/select/queries/:id', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const done = await setArchived(env.db, queryId(context), user!, true)
    if (!done) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json({ ok: true, archived: true })
  })

  app.post('/api/select/queries/:id/restore', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const done = await setArchived(env.db, queryId(context), user!, false)
    if (!done) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json(await loadRecord(env.db, queryId(context), user!))
  })
}

async function setArchived(db: AppEnv['db'], id: string, user: SessionUser, archive: boolean): Promise<boolean> {
  return inTransaction(db, async (client) => {
    const { rows } = await client.query(
      `UPDATE saved_queries q
          SET archived_at = ${archive ? 'now()' : 'NULL'}, archived_by = ${archive ? '$2' : 'NULL'},
              version = q.version + 1, updated_by = $2, updated_at = now()
        WHERE q.id = $3 AND q.org_id = $1 AND q.archived_at IS ${archive ? 'NULL' : 'NOT NULL'} AND ${VISIBLE}
        RETURNING *`,
      [user.orgId, user.id, id],
    )
    if (!rows[0]) return false
    await writeRevision(client, rows[0], archive ? 'archive' : 'restore', user.id)
    return true
  })
}
