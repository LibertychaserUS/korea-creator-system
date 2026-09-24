import { randomUUID } from 'node:crypto'
import { validateSavedQuery } from '@kcs/contract'
import { coerceSavedQuery, savedQueryFromRow } from '../http/creators'
import { savedQueryPage } from '../http/pool'
import type { Context } from 'hono'
import { z } from 'zod'
import { readJson } from '../http/body'
import { jsonError } from '../http/responses'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'

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

export function registerSelectQueryRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/select/queries', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT * FROM saved_queries WHERE org_id IS NULL OR org_id = $1
       ORDER BY updated_at DESC, id`,
      [user!.orgId],
    )
    return context.json({ items: rows.map(savedQueryFromRow) })
  })

  app.post('/api/select/queries/run', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const { data: raw, invalid } = await readJson(context, z.unknown())
    if (invalid) return invalid
    const spec = coerceSavedQuery(raw)
    const errors = validateSavedQuery(spec)
    if (errors.length) return invalidQuery(context, errors)
    return context.json(await savedQueryPage(env.db, spec, context.req.query()))
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
    const { rows } = await env.db.query(
      `INSERT INTO saved_queries (id, org_id, name, version, spec, created_by)
       VALUES ($1,$2,$3,1,$4,$5) RETURNING *`,
      [id, user!.orgId, spec.name, JSON.stringify(spec), user!.id],
    )
    return context.json(savedQueryFromRow(rows[0]), 201)
  })

  app.get('/api/select/queries/:id', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      'SELECT * FROM saved_queries WHERE id = $1 AND (org_id IS NULL OR org_id = $2)',
      [context.req.param('id'), user!.orgId],
    )
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json(savedQueryFromRow(rows[0]))
  })

  app.patch('/api/select/queries/:id', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const found = await env.db.query(
      'SELECT * FROM saved_queries WHERE id = $1 AND org_id = $2',
      [context.req.param('id'), user!.orgId],
    )
    if (!found.rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    const current = savedQueryFromRow(found.rows[0])
    const { data: patch, invalid } = await readJson(context, z.record(z.string(), z.unknown()))
    if (invalid) return invalid
    const spec = coerceSavedQuery({ ...current, ...patch }, current.id, current.version + 1)
    const errors = validateSavedQuery(spec)
    if (errors.length) return invalidQuery(context, errors)
    const { rows } = await env.db.query(
      `UPDATE saved_queries SET name = $3, version = $4, spec = $5, updated_at = now()
       WHERE id = $1 AND org_id = $2 RETURNING *`,
      [current.id, user!.orgId, spec.name, spec.version, JSON.stringify(spec)],
    )
    return context.json(savedQueryFromRow(rows[0]))
  })

  app.delete('/api/select/queries/:id', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const result = await env.db.query(
      'DELETE FROM saved_queries WHERE id = $1 AND org_id = $2',
      [context.req.param('id'), user!.orgId],
    )
    if (!result.rowCount) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json({ ok: true })
  })
}
