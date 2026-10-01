import { randomUUID } from 'node:crypto'
import { exportLocale, projectSheet, tierOf, validateSavedQuery, type SavedQuery } from '@kcs/contract'
import { audit } from '../http/audit'
import { validateBrief } from '../http/brief'
import {
  asPublished,
  attachCreatorMeta,
  coerceSavedQuery,
  loadCreator,
  metricsFromRow,
  publicPoolRow,
  inSelectPool,
} from '../http/creators'
import { recordEvents } from '../http/events'
import { Params, countPoolRows, savedQueryClauses, withPercentiles } from '../http/pool'
import { inTransaction, metricColumn } from '../http/published'
import type { Context } from 'hono'
import { z } from 'zod'
import {
  assignmentsBody,
  kcsAssignmentBody,
  projectCreateBody,
  projectPatchBody,
  readJson,
  validationError,
} from '../http/body'
import { jsonError } from '../http/responses'
import { projectView } from '../http/views'
import type { AppEnv, KcsApp, RouteHelpers, SessionUser } from '../http/types'

const iso = (value: unknown): string | null =>
  value == null ? null : value instanceof Date ? value.toISOString() : String(value)

const num = (value: unknown): number | null => {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function registerSelectProjectRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/select/projects', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT p.*, (SELECT count(*) FROM assignments a WHERE a.project_id = p.id)::int AS member_count
       FROM projects p WHERE p.org_id = $1 AND p.status = 'open' ORDER BY p.updated_at DESC, p.id`,
      [user!.orgId],
    )
    return context.json({ items: rows.map(projectView) })
  })

  app.post('/api/select/projects', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const { data: body, invalid } = await readJson(context, projectCreateBody)
    if (invalid) return invalid
    const { brief, fields } = validateBrief(body.brief)
    if (fields.length) return validationError(context, 'invalid_brief', fields)
    const id = randomUUID()
    await env.db.query(
      'INSERT INTO projects (id, org_id, name, note, brief) VALUES ($1,$2,$3,$4,$5::jsonb)',
      [id, user!.orgId, body.name, body.note || null, brief == null ? null : JSON.stringify(brief)],
    )
    await audit(env.db, user!.id, 'project.create', 'project', id, body.name)
    return context.json({ id, name: body.name }, 201)
  })

  /** Partial update; `brief: null` clears the brief, an object replaces it wholesale. */
  app.patch('/api/select/projects/:id', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const { data: body, invalid } = await readJson(context, projectPatchBody)
    if (invalid) return invalid
    const { brief, fields } = validateBrief(body.brief)
    if (fields.length) return validationError(context, 'invalid_brief', fields)
    const sets: string[] = []
    const values: unknown[] = []
    const set = (clause: string, value: unknown) => {
      values.push(value)
      sets.push(clause.replace('?', `$${values.length}`))
    }
    if (body.name !== undefined) set('name = ?', body.name)
    if (body.note !== undefined) set('note = ?', body.note)
    if (brief !== undefined) set('brief = ?::jsonb', brief == null ? null : JSON.stringify(brief))
    if (!sets.length) return jsonError(context, 400, 'VALIDATION', 'empty_patch: nothing to update')
    sets.push('updated_at = now()')
    const { rows } = await env.db.query(
      `UPDATE projects SET ${sets.join(', ')}
        WHERE id = $${values.length + 1} AND org_id = $${values.length + 2} RETURNING *`,
      [...values, context.req.param('id'), user!.orgId],
    )
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    await audit(env.db, user!.id, 'project.update', 'project', rows[0].id, rows[0].name)
    const members = await env.db.query(
      'SELECT count(*)::int AS n FROM assignments WHERE project_id = $1',
      [rows[0].id],
    )
    return context.json(projectView({ ...rows[0], member_count: members.rows[0].n }))
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
              c.metrics, c.metrics_locked, c.metrics_locked_at, c.metrics_locked_fetched_at, c.source, c.external_id, c.metrics_fetched_at
       FROM assignments a JOIN creators c ON c.id = a.creator_id
       WHERE a.project_id = $1 ORDER BY a.assigned_at DESC, a.id`,
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
        metrics_locked_fetched_at: row.metrics_locked_fetched_at,
        source: row.source,
        external_id: row.external_id,
        metrics_fetched_at: row.metrics_fetched_at,
      })),
      false,
    )
    const enriched = await withPercentiles(env.db, meta.map(asPublished))
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

  /**
   * 任务工作区：mission（含 brief）+ 选人漏斗 + 篮子里每位达人的池内
   * 指标 / 分位 + 当前池总量。指标取自 `creator_published` 投影（与选人池
   * 同一份 m_ 列和 ranks）；达人离开池后（published 行没了）照常列出，
   * 指标给 null 并标 `poolGone`。
   */
  app.get('/api/select/projects/:id/workspace', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const projectId = context.req.param('id')
    const project = await env.db.query(
      'SELECT * FROM projects WHERE id = $1 AND org_id = $2',
      [projectId, user!.orgId],
    )
    const row = project.rows[0]
    if (!row) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    const brief = row.brief ?? null
    const [funnel, basket, poolTotal] = await Promise.all([
      env.db.query(
        `SELECT count(*)::int AS basket,
                count(*) FILTER (WHERE status <> 'assigned')::int AS decided
           FROM assignments WHERE project_id = $1`,
        [projectId],
      ),
      env.db.query(
        `SELECT a.creator_id, a.status AS assignment_status, a.assigned_at, a.pool_gone,
                c.display_name, c.followers, c.source,
                p.tier AS pool_tier, p.ranks,
                p.${metricColumn('engagementRate')} AS m_er, p.${metricColumn('readMedian')} AS m_rm,
                p.${metricColumn('cpr')} AS m_cpr, p.${metricColumn('cpe')} AS m_cpe,
                p.${metricColumn('priceImage')} AS m_price_image
           FROM assignments a
           JOIN creators c ON c.id = a.creator_id
           LEFT JOIN creator_published p ON p.creator_id = c.id
          WHERE a.project_id = $1
          ORDER BY a.assigned_at DESC, a.creator_id COLLATE "C"`,
        [projectId],
      ),
      countPoolRows(env.db, [], []),
    ])
    const rankOf = (ranks: Record<string, any> | null): number | null => {
      const percentile = ranks?.engagementRate?.percentile
      return typeof percentile === 'number' && Number.isFinite(percentile) ? percentile : null
    }
    return context.json({
      mission: {
        id: row.id,
        name: row.name,
        note: row.note ?? null,
        status: row.status,
        brief,
        createdAt: iso(row.created_at)!,
        deadlineFromBrief: brief?.deadline ?? null,
      },
      funnel: {
        basket: funnel.rows[0].basket,
        decided: funnel.rows[0].decided,
      },
      basket: basket.rows.map((item) => {
        const followers = num(item.followers)
        return {
          creatorId: item.creator_id,
          displayName: item.display_name,
          followers,
          tier: item.pool_tier ?? (followers == null ? null : tierOf(followers)),
          priceImage: num(item.m_price_image),
          source: item.source ?? null,
          metrics: {
            engagementRate: num(item.m_er),
            readMedian: num(item.m_rm),
            cpr: num(item.m_cpr),
            cpe: num(item.m_cpe),
          },
          percentiles: { engagementRate: rankOf(item.ranks) },
          assignmentStatus: item.assignment_status,
          addedAt: iso(item.assigned_at)!,
          poolGone: Boolean(item.pool_gone),
        }
      }),
      coverage: { poolTotal },
    })
  })

  /**
   * 0 结果归因：把保存查询的 spec 拆成独立条件，每个条件单独对选人池
   * count 一次，前端据此说清「哪条条件筛光了人」。条件套的是
   * `savedQueryClauses` —— 与 `/queries/run` 逐字同一份过滤 SQL；拆不
   * 动的条件 count 返回 null。所有 count 一次性并发查询（同一快照口径
   * 与 /queries/run 一致：池表本身，不含黑名单行）。
   */
  app.post('/api/select/projects/:id/explain', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const projectId = context.req.param('id')
    if (!(await ownProject(projectId, user!.orgId))) {
      return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    }
    const { data: body, invalid } = await readJson(context, z.looseObject({ spec: z.unknown().optional() }))
    if (invalid) return invalid
    const spec = coerceSavedQuery(body.spec)
    spec.name ||= 'explain'
    const errors = validateSavedQuery(spec)
    if (errors.length) {
      return validationError(context, 'invalid_query', errors.map((key) => ({
        path: key.split('.')[0],
        message: key,
      })))
    }

    // 单条件 spec：只留一个条件，其余全部空（= 不过滤）。key 与前端展示对应。
    const blank: Partial<SavedQuery> = {
      sources: [], tiers: [], health: [], regions: [], brandsAny: [], categories: [],
      hasCollaborated: null, collabCountMin: null, collabCountMax: null,
      search: '', filters: [], groups: [],
    }
    const clauses: Array<{ key: string; spec: SavedQuery }> = []
    const only = (key: string, patch: Partial<SavedQuery>) =>
      clauses.push({ key, spec: { ...spec, ...blank, ...patch } })
    if (spec.search.trim()) only('search', { search: spec.search })
    for (const filter of spec.filters) only(`filters.${filter.key}`, { filters: [filter] })
    for (const [index, group] of (spec.groups ?? []).entries()) {
      if (group.filters.length) only(`groups.${index}`, { groups: [group] })
    }
    if (spec.tiers.length) only('tier', { tiers: spec.tiers })
    if (spec.health.length) only('health', { health: spec.health })
    if (spec.regions.length) only('region', { regions: spec.regions })
    if (spec.sources.length) only('sources', { sources: spec.sources })
    if (spec.brandsAny.length) only('brandsAny', { brandsAny: spec.brandsAny })
    if (spec.categories?.length) only('categories', { categories: spec.categories })
    if (spec.hasCollaborated != null) only('hasCollaborated', { hasCollaborated: spec.hasCollaborated })
    if (spec.collabCountMin != null || spec.collabCountMax != null) {
      only('collabCount', { collabCountMin: spec.collabCountMin, collabCountMax: spec.collabCountMax })
    }

    const now = env.now()
    const countOf = async (query: SavedQuery): Promise<number | null> => {
      const params = new Params()
      try {
        const where = savedQueryClauses(query, params, now)
        return await countPoolRows(env.db, where, params.values)
      } catch {
        return null
      }
    }
    const [total, ...counts] = await Promise.all([
      countOf(spec),
      ...clauses.map((clause) => countOf(clause.spec)),
    ])
    return context.json({
      total,
      clauses: clauses.map((clause, index) => ({ key: clause.key, count: counts[index] })),
    })
  })

  app.delete('/api/select/projects/:id', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const projectId = context.req.param('id')
    const removed = await inTransaction(env.db, async (client) => {
      const found = await client.query(
        'SELECT id, name FROM projects WHERE id = $1 AND org_id = $2 FOR UPDATE',
        [projectId, user!.orgId],
      )
      if (!found.rowCount) return null
      // shortlist_items never points at a project; assignments is the only
      // child, and it cascades — but a project with members is a mistake to
      // silently empty, so the delete stops here and says so.
      const members = await client.query(
        'SELECT count(*)::int AS n FROM assignments WHERE project_id = $1',
        [projectId],
      )
      if (members.rows[0].n > 0) return { blocked: true, name: found.rows[0].name as string }
      await client.query('DELETE FROM projects WHERE id = $1', [projectId])
      return { blocked: false, name: found.rows[0].name as string }
    })
    if (!removed) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    if (removed.blocked) {
      return jsonError(context, 409, 'CONFLICT', 'project_not_empty: remove its members first')
    }
    await audit(env.db, user!.id, 'project.delete', 'project', projectId, removed.name)
    return context.json({ ok: true })
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
      if (!creator || !inSelectPool(creator)) {
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
    await inTransaction(env.db, async (client) => {
      for (const creatorId of creatorIds) {
        await client.query(
          `INSERT INTO assignments (id, project_id, creator_id, status, assigned_by)
           VALUES ($1,$2,$3,'assigned',$4)`,
          [randomUUID(), projectId, creatorId, user.id],
        )
      }
      await client.query('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId])
      await recordEvents(client, creatorIds.map((creatorId) => ({
        kind: 'assign' as const, creatorId, orgId: user.orgId, actorId: user.id, projectId, context: { projectId },
      })))
    })
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
    const projectId = context.req.param('id')
    const creatorId = context.req.param('creatorId')
    const removed = await inTransaction(env.db, async (client) => {
      const result = await client.query(
        'DELETE FROM assignments WHERE project_id = $1 AND creator_id = $2',
        [projectId, creatorId],
      )
      if (!result.rowCount) return result
      await client.query('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId])
      await recordEvents(client, [{ kind: 'unassign', creatorId, orgId: user!.orgId, actorId: user!.id, projectId, context: { projectId } }])
      return result
    })
    if (!removed.rowCount) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
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
      `SELECT c.id, c.display_name, c.xhs_id, c.source, c.followers, c.metrics_locked_at,
              COALESCE(c.metrics_locked, c.metrics) AS metrics, a.pool_gone
       FROM assignments a JOIN creators c ON c.id = a.creator_id
       WHERE a.project_id = $1
       ORDER BY a.assigned_at, c.display_name, a.id`,
      [projectId],
    )
    const locale = exportLocale(context.req.query('locale'))
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
      locale,
    )
    await recordEvents(env.db, rows.map((row) => ({
      kind: 'export' as const, creatorId: String(row.id), orgId: user!.orgId, actorId: user!.id, projectId, context: { projectId, locale },
    })))
    const name = String(project.rows[0].name || 'project').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim() || 'project'
    return context.body(sheet, 200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="project.csv"; filename*=UTF-8''${encodeURIComponent(name)}.csv`,
    })
  })
}
