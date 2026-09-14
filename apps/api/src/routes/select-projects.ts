import { randomUUID } from 'node:crypto'
import { DEFAULT_QUERY_COLUMNS } from '@kcs/contract'
import { audit } from '../http/audit'
import {
  attachCreatorMeta,
  csvCell,
  enrichPoolItems,
  loadCreator,
  metricsFromRow,
  publicPoolRow,
  queryPool,
} from '../http/creators'
import { jsonError } from '../http/responses'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'

export function registerSelectProjectRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/select/projects', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT p.*, (SELECT count(*) FROM assignments a WHERE a.project_id = p.id)::int AS member_count
       FROM projects p WHERE p.org_id = $1 AND p.status = 'open' ORDER BY p.updated_at DESC`,
      [user!.orgId],
    )
    return context.json({ items: rows })
  })

  app.post('/api/select/projects', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const body = await context.req.json()
    if (!body.name) return jsonError(context, 400, 'name_required')
    const id = randomUUID()
    await env.db.query(
      'INSERT INTO projects (id, org_id, name, note) VALUES ($1,$2,$3,$4)',
      [id, user!.orgId, body.name, body.note ?? null],
    )
    await audit(env.db, user!.id, 'project.create', 'project', id, body.name)
    return context.json({ id, name: body.name }, 201)
  })

  app.get('/api/select/projects/:id', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      'SELECT * FROM projects WHERE id = $1 AND org_id = $2',
      [context.req.param('id'), user!.orgId],
    )
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    const assigned = await env.db.query(
      `SELECT a.id, a.creator_id, a.status, a.pool_gone, a.assigned_at,
              c.display_name, c.followers, c.creator_key, c.status AS creator_status,
              c.regions, c.verticals, c.needs_review, c.followers_unknown, c.avatar_key,
              c.metrics, c.metrics_locked, c.source, c.external_id, c.metrics_fetched_at
       FROM assignments a JOIN creators c ON c.id = a.creator_id
       WHERE a.project_id = $1 ORDER BY a.assigned_at DESC`,
      [context.req.param('id')],
    )
    const meta = await attachCreatorMeta(
      env.db,
      assigned.rows.map((row) => ({
        id: row.creator_id,
        creator_key: row.creator_key,
        display_name: row.display_name,
        followers: row.followers,
        status: row.creator_status,
        regions: row.regions,
        verticals: row.verticals,
        needs_review: row.needs_review,
        followers_unknown: row.followers_unknown,
        avatar_key: row.avatar_key,
        metrics: row.metrics,
        metrics_locked: row.metrics_locked,
        source: row.source,
        external_id: row.external_id,
        metrics_fetched_at: row.metrics_fetched_at,
      })),
      false,
    )
    const pool = await queryPool(env.db, {})
    const enriched = enrichPoolItems(meta, pool)
    return context.json({
      ...rows[0],
      assignments: enriched.map((item, index) => {
        const row = assigned.rows[index]
        return {
          ...publicPoolRow(item),
          id: row.id,
          creatorId: item.id,
          status: row.status,
          poolGone: row.pool_gone,
        }
      }),
    })
  })

  async function assign(context: Parameters<typeof helpers.requireAuth>[0], bodyOverride?: Record<string, any>) {
    const { user, denied } = await helpers.requireAuth(context, 'select.assign')
    if (denied) return denied
    const projectId = bodyOverride?.projectId ?? context.req.param('id')
    const body: Record<string, any> = bodyOverride ?? await context.req.json()
    const ids: string[] = body.creatorIds || []
    if (!ids.length) return jsonError(context, 400, 'empty')
    for (const rawId of ids) {
      let creatorId = rawId
      if (body.creatorKey || !(await loadCreator(env.db, rawId, false))) {
        const byKey = await env.db.query(
          'SELECT id FROM creators WHERE creator_key = $1',
          [body.creatorKey || rawId],
        )
        if (byKey.rows[0]) creatorId = byKey.rows[0].id
      }
      const creator = await loadCreator(env.db, creatorId, false)
      if (!creator || creator.status !== 'released' || creator.categories.includes('blacklist')) {
        return jsonError(context, 400, 'not_in_pool')
      }
      const exists = await env.db.query(
        'SELECT 1 FROM assignments WHERE project_id = $1 AND creator_id = $2',
        [projectId, creatorId],
      )
      if (exists.rowCount) return jsonError(context, 409, 'already_assigned')
      await env.db.query(
        `INSERT INTO assignments (id, project_id, creator_id, status, assigned_by)
         VALUES ($1,$2,$3,'assigned',$4)`,
        [randomUUID(), projectId, creatorId, user!.id],
      )
    }
    await env.db.query('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId])
    await audit(env.db, user!.id, 'assignment.create', 'project', projectId, ids.join(','))
    return context.json({ ok: true })
  }

  app.post('/api/select/projects/:id/assignments', (context) => assign(context))

  app.post('/api/kcs/assignments', async (context) => {
    const body = await context.req.json()
    let creatorId = body.creatorId ? String(body.creatorId) : ''
    if (!creatorId && body.creatorKey) {
      const found = await env.db.query('SELECT id FROM creators WHERE creator_key = $1', [body.creatorKey])
      creatorId = found.rows[0]?.id
    }
    return assign(context, {
      projectId: String(body.projectId || ''),
      creatorIds: [creatorId],
      creatorKey: body.creatorKey,
    })
  })

  app.delete('/api/select/projects/:id/assignments/:creatorId', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.assign')
    if (denied) return denied
    await env.db.query(
      'DELETE FROM assignments WHERE project_id = $1 AND creator_id = $2',
      [context.req.param('id'), context.req.param('creatorId')],
    )
    await env.db.query('UPDATE projects SET updated_at = now() WHERE id = $1', [
      context.req.param('id'),
    ])
    await audit(
      env.db,
      user!.id,
      'assignment.remove',
      'project',
      context.req.param('id'),
      context.req.param('creatorId'),
    )
    return context.json({ ok: true })
  })

  app.get('/api/select/projects/:id/export', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT c.display_name, c.metrics, c.followers, a.status
       FROM assignments a JOIN creators c ON c.id = a.creator_id
       WHERE a.project_id = $1`,
      [context.req.param('id')],
    )
    const header = ['display_name', ...DEFAULT_QUERY_COLUMNS, 'status'].join(',') + '\n'
    const csv = header + rows.map((row) => {
      const metrics = metricsFromRow(row)
      return [
        csvCell(row.display_name),
        ...DEFAULT_QUERY_COLUMNS.map((key) => metrics[key] ?? ''),
        csvCell(row.status),
      ].join(',')
    }).join('\n')
    return context.body(csv, 200, { 'content-type': 'text/csv; charset=utf-8' })
  })
}
