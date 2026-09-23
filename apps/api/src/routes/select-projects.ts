import { randomUUID } from 'node:crypto'
import { exportLocale, projectSheet, RANKED_METRIC_KEYS } from '@kcs/contract'
import { audit } from '../http/audit'
import {
  asPublished,
  attachCreatorMeta,
  loadCreator,
  metricsFromRow,
  publicPoolRow,
} from '../http/creators'
import { ensurePublishedSnapshots, withPercentiles } from '../http/pool'
import type { Context } from 'hono'
import { assignmentsBody, kcsAssignmentBody, projectCreateBody, readJson, validationError } from '../http/body'
import { jsonError } from '../http/responses'
import { projectView } from '../http/views'
import type { AppEnv, KcsApp, RouteHelpers, SessionUser } from '../http/types'

export function registerSelectProjectRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/select/projects', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT p.*, (SELECT count(*) FROM assignments a WHERE a.project_id = p.id)::int AS member_count
       FROM projects p WHERE p.org_id = $1 AND p.status = 'open' ORDER BY p.updated_at DESC`,
      [user!.orgId],
    )
    return context.json({ items: rows.map(projectView) })
  })

  app.post('/api/select/projects', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const { data: body, invalid } = await readJson(context, projectCreateBody)
    if (invalid) return invalid
    const id = randomUUID()
    await env.db.query(
      'INSERT INTO projects (id, org_id, name, note) VALUES ($1,$2,$3,$4)',
      [id, user!.orgId, body.name, body.note || null],
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
              c.metrics, c.metrics_locked, c.metrics_locked_at, c.source, c.external_id, c.metrics_fetched_at
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
        metrics_locked_at: row.metrics_locked_at,
        source: row.source,
        external_id: row.external_id,
        metrics_fetched_at: row.metrics_fetched_at,
      })),
      false,
    )
    await ensurePublishedSnapshots(env.db)
    const enriched = await withPercentiles(env.db, meta.map(asPublished), {
      nullSourceCohort: false,
      keys: RANKED_METRIC_KEYS,
    })
    return context.json({
      ...projectView({ ...rows[0], member_count: assigned.rows.length }),
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

  type AssignBody = { projectId: string; creatorIds: string[]; creatorKey?: string }

  async function ownProject(projectId: string, orgId: string) {
    const { rowCount } = await env.db.query(
      'SELECT 1 FROM projects WHERE id = $1 AND org_id = $2',
      [projectId, orgId],
    )
    return Boolean(rowCount)
  }

  async function assign(context: Context, user: SessionUser, body: AssignBody) {
    const { projectId, creatorIds: ids } = body
    if (!(await ownProject(projectId, user.orgId))) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    // Check every creator before writing any row, so a bad id leaves nothing half-assigned.
    const creatorIds: string[] = []
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
        return validationError(context, 'not_in_pool', [
          { path: 'creatorIds', message: `not in the released pool: ${rawId}` },
        ])
      }
      const exists = await env.db.query(
        'SELECT 1 FROM assignments WHERE project_id = $1 AND creator_id = $2',
        [projectId, creatorId],
      )
      if (exists.rowCount) return jsonError(context, 409, 'CONFLICT', 'already_assigned')
      if (!creatorIds.includes(creatorId)) creatorIds.push(creatorId)
    }
    for (const creatorId of creatorIds) {
      await env.db.query(
        `INSERT INTO assignments (id, project_id, creator_id, status, assigned_by)
         VALUES ($1,$2,$3,'assigned',$4)`,
        [randomUUID(), projectId, creatorId, user.id],
      )
    }
    await env.db.query('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId])
    await audit(env.db, user.id, 'assignment.create', 'project', projectId, ids.join(','))
    return context.json({ ok: true })
  }

  app.post('/api/select/projects/:id/assignments', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.assign')
    if (denied) return denied
    const { data: body, invalid } = await readJson(context, assignmentsBody)
    if (invalid) return invalid
    return assign(context, user!, { ...body, projectId: context.req.param('id') })
  })

  app.post('/api/kcs/assignments', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.assign')
    if (denied) return denied
    const { data: body, invalid } = await readJson(context, kcsAssignmentBody)
    if (invalid) return invalid
    let creatorId = body.creatorId ?? ''
    if (!creatorId && body.creatorKey) {
      const found = await env.db.query('SELECT id FROM creators WHERE creator_key = $1', [body.creatorKey])
      creatorId = found.rows[0]?.id ?? body.creatorKey
    }
    return assign(context, user!, {
      projectId: body.projectId,
      creatorIds: [creatorId],
      creatorKey: body.creatorKey,
    })
  })

  app.delete('/api/select/projects/:id/assignments/:creatorId', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.assign')
    if (denied) return denied
    if (!(await ownProject(context.req.param('id'), user!.orgId))) {
      return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    }
    const removed = await env.db.query(
      'DELETE FROM assignments WHERE project_id = $1 AND creator_id = $2',
      [context.req.param('id'), context.req.param('creatorId')],
    )
    if (!removed.rowCount) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
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
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const projectId = context.req.param('id')
    const project = await env.db.query(
      'SELECT name FROM projects WHERE id = $1 AND org_id = $2',
      [projectId, user!.orgId],
    )
    if (!project.rowCount) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    // Same numbers the pool ranked on: the publish snapshot, falling back to
    // the latest record for rows published before snapshots existed.
    const { rows } = await env.db.query(
      `SELECT c.display_name, c.xhs_id, c.source, c.followers, c.metrics_locked_at,
              COALESCE(c.metrics_locked, c.metrics) AS metrics, a.pool_gone
       FROM assignments a JOIN creators c ON c.id = a.creator_id
       WHERE a.project_id = $1
       ORDER BY a.assigned_at, c.display_name`,
      [projectId],
    )
    const sheet = projectSheet(
      rows.map((row) => ({
        displayName: row.display_name,
        xhsId: row.xhs_id ?? null,
        source: row.source ?? null,
        followers: row.followers == null ? null : Number(row.followers),
        metrics: metricsFromRow(row),
        poolGone: Boolean(row.pool_gone),
        metricsLockedAt: row.metrics_locked_at ?? null,
      })),
      exportLocale(context.req.query('locale')),
    )
    const name = String(project.rows[0].name || 'project').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim() || 'project'
    return context.body(sheet, 200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="project.csv"; filename*=UTF-8''${encodeURIComponent(name)}.csv`,
    })
  })
}
