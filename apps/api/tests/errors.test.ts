import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('request errors', () => {
  let ctx: TestCtx
  let ops: string
  let selector: string

  const call = (token: string, method: string, path: string, body?: string) =>
    ctx.app.request(path, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body,
    })

  const auditCount = async (entityId: string) => {
    const { rows } = await ctx.db.query(
      'SELECT count(*)::int AS n FROM audit_logs WHERE entity_id = $1',
      [entityId],
    )
    return rows[0].n as number
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    ops = (await ctx.loginJson('ops@kcs.local')).token
    selector = (await ctx.loginJson('selector@kcs.local')).token
  })
  afterAll(() => ctx.close())

  it('broken JSON is 400 VALIDATION on every JSON write route, never 500', async () => {
    const creator = (await ctx.db.query('SELECT id FROM creators LIMIT 1')).rows[0].id
    const routes: Array<[string, string, string]> = [
      [ops, 'POST', '/api/ops/creators'],
      [ops, 'PATCH', `/api/ops/creators/${creator}`],
      [ops, 'PATCH', '/api/ops/categories/intending'],
      [ops, 'POST', '/api/assets/presign'],
      [ops, 'POST', '/api/ingest/fetch'],
      [selector, 'POST', '/api/select/projects'],
      [selector, 'POST', '/api/select/projects/any/assignments'],
      [selector, 'POST', '/api/kcs/assignments'],
      [selector, 'POST', '/api/select/shortlist'],
      [selector, 'POST', '/api/select/queries'],
      [selector, 'POST', '/api/select/queries/run'],
    ]
    for (const [token, method, path] of routes) {
      const res = await call(token, method, path, '{"displayName": ')
      expect(res.status, `${method} ${path}`).toBe(400)
      expect((await res.json()).error, `${method} ${path}`).toMatchObject({
        code: 'VALIDATION',
        message: 'invalid_json',
      })
    }
  })

  it('schema failures name the offending fields and write nothing', async () => {
    const before = (await ctx.db.query('SELECT count(*)::int AS n FROM creators')).rows[0].n
    const res = await call(ops, 'POST', '/api/ops/creators', JSON.stringify({
      displayName: '   ',
      followers: -5,
      price: { amountMin: 'lots' },
      collaborations: [{ happenedAt: 'yesterday' }],
    }))
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error.code).toBe('VALIDATION')
    const paths = error.fields.map((field: { path: string }) => field.path)
    expect(paths).toEqual(expect.arrayContaining([
      'displayName',
      'followers',
      'price.amountMin',
      'collaborations.0.brand',
      'collaborations.0.happenedAt',
    ]))
    const after = (await ctx.db.query('SELECT count(*)::int AS n FROM creators')).rows[0].n
    expect(after).toBe(before)
  })

  it('a metric of 1e400 (Infinity once parsed) or "12" is 400 on create and edit, and nothing is written', async () => {
    const creator = (await ctx.db.query('SELECT id, metrics FROM creators LIMIT 1')).rows[0]
    const before = (await ctx.db.query('SELECT count(*)::int AS n FROM creators')).rows[0].n
    const created = await call(ops, 'POST', '/api/ops/creators', '{"displayName":"inf","regions":["x"],"metrics":{"window":30,"cpe":1e400}}')
    expect(created.status).toBe(400)
    expect((await created.json()).error.fields.map((f: { path: string }) => f.path)).toContain('metrics.cpe')
    const patched = await call(ops, 'PATCH', `/api/ops/creators/${creator.id}`, '{"metrics":{"window":30,"readMedian":"12"}}')
    expect(patched.status).toBe(400)
    expect((await ctx.db.query('SELECT count(*)::int AS n FROM creators')).rows[0].n).toBe(before)
    expect((await ctx.db.query('SELECT metrics FROM creators WHERE id = $1', [creator.id])).rows[0].metrics).toEqual(creator.metrics)
  })

  it('an unknown category slug is 400 with the slug, not a foreign-key 500 or a half-written creator', async () => {
    const res = await call(ops, 'POST', '/api/ops/creators', JSON.stringify({
      displayName: '分类不存在',
      categories: ['no_such_slug'],
    }))
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error.message).toBe('unknown_category')
    expect(error.fields[0].message).toContain('no_such_slug')
    const left = await ctx.db.query("SELECT 1 FROM creators WHERE display_name = '分类不存在'")
    expect(left.rowCount).toBe(0)
  })

  it('a duplicate creatorKey is 409 CONFLICT, not 500', async () => {
    const key = (await ctx.db.query('SELECT creator_key FROM creators LIMIT 1')).rows[0].creator_key
    const res = await call(ops, 'POST', '/api/ops/creators', JSON.stringify({
      displayName: '重复键',
      creatorKey: key,
    }))
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('CONFLICT')
  })

  it('PATCH / unpublish of a creator that does not exist is 404 and leaves no audit row', async () => {
    const ghost = 'creator-that-never-existed'
    const patch = await call(ops, 'PATCH', `/api/ops/creators/${ghost}`, JSON.stringify({ displayName: 'x' }))
    expect(patch.status).toBe(404)
    expect((await patch.json()).error.code).toBe('NOT-FOUND')
    const unpublish = await call(ops, 'POST', `/api/ops/creators/${ghost}/unpublish`)
    expect(unpublish.status).toBe(404)
    expect((await unpublish.json()).error.code).toBe('NOT-FOUND')
    expect(await auditCount(ghost)).toBe(0)
  })

  it('PATCH of a missing category is 404', async () => {
    const res = await call(ops, 'PATCH', '/api/ops/categories/no_such_slug', JSON.stringify({ enabled: true }))
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NOT-FOUND')
  })

  it('assignments to a missing project, removing a row that is not there, and exporting nothing are 404 without audit', async () => {
    const creator = (await ctx.db.query("SELECT id FROM creators WHERE status = 'released' LIMIT 1")).rows[0].id
    const ghost = 'project-that-never-existed'
    const assign = await call(selector, 'POST', `/api/select/projects/${ghost}/assignments`, JSON.stringify({
      creatorIds: [creator],
    }))
    expect(assign.status).toBe(404)
    const viaKcs = await call(selector, 'POST', '/api/kcs/assignments', JSON.stringify({
      projectId: ghost,
      creatorId: creator,
    }))
    expect(viaKcs.status).toBe(404)
    const exported = await call(selector, 'GET', `/api/select/projects/${ghost}/export`)
    expect(exported.status).toBe(404)
    expect(await auditCount(ghost)).toBe(0)

    const project = await (await call(selector, 'POST', '/api/select/projects', JSON.stringify({ name: '空项目' }))).json()
    const remove = await call(selector, 'DELETE', `/api/select/projects/${project.id}/assignments/${creator}`)
    expect(remove.status).toBe(404)
    expect((await remove.json()).error.code).toBe('NOT-FOUND')
    const removals = await ctx.db.query(
      "SELECT 1 FROM audit_logs WHERE entity_id = $1 AND action = 'assignment.remove'",
      [project.id],
    )
    expect(removals.rowCount).toBe(0)
  })

  it('one bad creator id in a batch assigns nobody', async () => {
    const released = (await ctx.db.query("SELECT id FROM creators WHERE status = 'released' LIMIT 1")).rows[0].id
    const project = await (await call(selector, 'POST', '/api/select/projects', JSON.stringify({ name: '批量' }))).json()
    const res = await call(selector, 'POST', `/api/select/projects/${project.id}/assignments`, JSON.stringify({
      creatorIds: [released, 'not-a-creator'],
    }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatchObject({ code: 'VALIDATION', message: 'not_in_pool' })
    const rows = await ctx.db.query('SELECT 1 FROM assignments WHERE project_id = $1', [project.id])
    expect(rows.rowCount).toBe(0)
  })

  it('project name and assignment list are required with field details', async () => {
    const project = await call(selector, 'POST', '/api/select/projects', JSON.stringify({ name: '' }))
    expect(project.status).toBe(400)
    expect((await project.json()).error.fields[0].path).toBe('name')
    const empty = await call(selector, 'POST', '/api/select/projects/any/assignments', JSON.stringify({ creatorIds: [] }))
    expect(empty.status).toBe(400)
    expect((await empty.json()).error.fields[0].path).toBe('creatorIds')
  })

  it('shortlisting a creator that is not in the pool is 404, not a foreign-key 500', async () => {
    const res = await call(selector, 'POST', '/api/select/shortlist', JSON.stringify({ creatorId: 'nobody' }))
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NOT-FOUND')
  })

  it('auth still comes first: a stranger with a broken body gets 401, a viewer gets 403', async () => {
    const anon = await ctx.app.request('/api/ops/creators', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    expect(anon.status).toBe(401)
    const viewer = (await ctx.loginJson('viewer@kcs.local')).token
    const denied = await call(viewer, 'POST', '/api/select/projects/any/assignments', '{')
    expect(denied.status).toBe(403)
  })
})
