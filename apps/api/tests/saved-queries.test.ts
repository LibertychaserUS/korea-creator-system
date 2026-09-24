import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultSavedQuery } from '@kcs/contract'
import { createTestApp, type TestCtx } from './helpers'

describe('saved query CRUD and run', () => {
  let ctx: TestCtx
  let token: string
  let id: string

  beforeAll(async () => {
    ctx = await createTestApp()
    token = (await ctx.loginJson('selector@kcs.local')).token
  })
  afterAll(() => ctx.close())

  it('rejects an invalid query with field errors', async () => {
    const res = await ctx.app.request('/api/select/queries', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', filters: [] }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: {
        code: 'VALIDATION',
        message: 'invalid_query',
        fields: [{ path: 'name', message: 'name.required' }],
      },
      errors: ['name.required'],
    })
  })

  it('creates, lists, reads and increments version on patch', async () => {
    const spec = defaultSavedQuery({
      name: '测试性价比',
      filters: [{ key: 'cpe', op: 'lte', value: 3 }],
      health: ['healthy'],
    })
    const created = await ctx.app.request('/api/select/queries', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(spec),
    })
    expect(created.status).toBe(201)
    const body = await created.json()
    id = body.id
    expect(body).toMatchObject({ name: '测试性价比', version: 1 })

    const list = await ctx.app.request('/api/select/queries', { headers: { authorization: `Bearer ${token}` } })
    expect((await list.json()).items.some((item: { id: string }) => item.id === id)).toBe(true)

    const patched = await ctx.app.request(`/api/select/queries/${id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '测试性价比 v2' }),
    })
    expect(await patched.json()).toMatchObject({ id, name: '测试性价比 v2', version: 2 })
  })

  it('runs an unsaved query and deletes the saved one', async () => {
    const run = await ctx.app.request('/api/select/queries/run', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(defaultSavedQuery({
        name: '临时查询',
        health: ['normal'],
        filters: [{ key: 'cpe', op: 'lte', value: 3 }],
      })),
    })
    expect(run.status).toBe(200)
    const result = await run.json()
    expect(result.total).toBeGreaterThan(0)
    expect(result.items.every((row: { metrics: { cpe: number; health: string } }) =>
      row.metrics.cpe <= 3 && row.metrics.health === 'normal')).toBe(true)
    expect(result.items[0]).toHaveProperty('flags')

    const removed = await ctx.app.request(`/api/select/queries/${id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(removed.status).toBe(200)
  })
})

describe('saved queries: 我的方案 / 团队方案, history, archive', () => {
  let ctx: TestCtx
  let selector: string
  let admin: string
  let viewer: string

  const call = (token: string, method: string, path: string, body?: unknown) =>
    ctx.app.request(path, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  const ids = async (token: string, qs = '') =>
    ((await (await call(token, 'GET', `/api/select/queries${qs}`)).json()).items as Array<{ id: string }>).map((q) => q.id)

  beforeAll(async () => {
    ctx = await createTestApp()
    selector = (await ctx.loginJson('selector@kcs.local')).token
    admin = (await ctx.loginJson('admin@kcs.local')).token
    viewer = (await ctx.loginJson('viewer@kcs.local')).token
  })
  afterAll(() => ctx.close())

  it('stores the { name, spec } shape the select page used to send as a flat spec, and drops list metadata', async () => {
    const res = await call(selector, 'POST', '/api/select/queries', {
      name: '包一层',
      spec: { ...defaultSavedQuery({ name: 'inner', filters: [{ key: 'cpe', op: 'lte', value: 2 }] }), mine: true, ownerName: 'x' },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ name: '包一层', filters: [{ key: 'cpe', op: 'lte', value: 2 }], mine: true, visibility: 'team' })
    const { rows } = await ctx.db.query('SELECT spec FROM saved_queries WHERE id = $1', [body.id])
    expect(rows[0].spec.spec).toBeUndefined()
    expect(rows[0].spec.mine).toBeUndefined()
    expect(rows[0].spec.filters).toEqual([{ key: 'cpe', op: 'lte', value: 2 }])
  })

  it('reads the real spec out of rows saved in the old nested shape', async () => {
    const nested = { ...defaultSavedQuery({ name: '旧' }), spec: defaultSavedQuery({ name: '旧', tiers: ['mid'], filters: [{ key: 'cpe', op: 'lte', value: 4 }] }) }
    await ctx.db.query(
      `INSERT INTO saved_queries (id, org_id, name, version, spec, created_by)
       SELECT 'q_nested_legacy', org_id, '旧', 1, $1, id FROM users WHERE email = 'selector@kcs.local'`,
      [JSON.stringify(nested)],
    )
    const body = await (await call(selector, 'GET', '/api/select/queries/q_nested_legacy')).json()
    expect(body).toMatchObject({ tiers: ['mid'], filters: [{ key: 'cpe', op: 'lte', value: 4 }] })
    expect(body.spec).toBeUndefined()
  })

  it('a private query is only visible to and editable by its author', async () => {
    const created = await (await call(selector, 'POST', '/api/select/queries', defaultSavedQuery({ name: '我自己的', visibility: 'private' }))).json()
    expect(created).toMatchObject({ visibility: 'private', mine: true, ownerName: '选人公司' })
    expect(await ids(selector, '?scope=mine')).toContain(created.id)
    expect(await ids(selector, '?scope=team')).not.toContain(created.id)
    expect(await ids(admin)).not.toContain(created.id)
    expect(await ids(viewer)).not.toContain(created.id)
    expect((await call(admin, 'GET', `/api/select/queries/${created.id}`)).status).toBe(404)
    expect((await call(admin, 'GET', `/api/select/queries/${created.id}/revisions`)).status).toBe(404)
    expect((await call(admin, 'PATCH', `/api/select/queries/${created.id}`, { name: '偷改' })).status).toBe(404)
    expect((await call(admin, 'DELETE', `/api/select/queries/${created.id}`)).status).toBe(404)

    const shared = await (await call(selector, 'PATCH', `/api/select/queries/${created.id}`, { visibility: 'team' })).json()
    expect(shared).toMatchObject({ visibility: 'team', version: 2 })
    expect(await ids(admin, '?scope=team')).toContain(created.id)
    const seen = await (await call(admin, 'GET', `/api/select/queries/${created.id}`)).json()
    expect(seen).toMatchObject({ mine: false, ownerName: '选人公司' })
  })

  it('only the author can make a team query private; anyone may edit it and the editor is recorded', async () => {
    const created = await (await call(selector, 'POST', '/api/select/queries', defaultSavedQuery({ name: '团队的' }))).json()
    const hide = await call(admin, 'PATCH', `/api/select/queries/${created.id}`, { visibility: 'private' })
    expect(hide.status).toBe(403)
    expect((await hide.json()).error).toEqual({ code: 'AUTH-DENIED', message: 'owner_only' })
    const edited = await (await call(admin, 'PATCH', `/api/select/queries/${created.id}`, { categories: ['beauty'] })).json()
    expect(edited).toMatchObject({ version: 2, categories: ['beauty'], updatedByName: '平台管理员', mine: false })
    expect((await call(viewer, 'PATCH', `/api/select/queries/${created.id}`, { name: 'x' })).status).toBe(403)
  })

  it('a stale version is a 409 with the current query; an unchanged save writes no version', async () => {
    const created = await (await call(selector, 'POST', '/api/select/queries', defaultSavedQuery({ name: '并发' }))).json()
    expect((await call(admin, 'PATCH', `/api/select/queries/${created.id}`, { ...created, search: '博主' })).status).toBe(200)
    const late = await call(selector, 'PATCH', `/api/select/queries/${created.id}`, { ...created, name: '覆盖' })
    expect(late.status).toBe(409)
    const conflict = await late.json()
    expect(conflict.error).toEqual({ code: 'CONFLICT', message: 'version_conflict' })
    expect(conflict.current).toMatchObject({ version: 2, search: '博主' })

    const current = await (await call(selector, 'GET', `/api/select/queries/${created.id}`)).json()
    const same = await (await call(selector, 'PATCH', `/api/select/queries/${created.id}`, current)).json()
    expect(same.version).toBe(2)
    const revisions = (await (await call(selector, 'GET', `/api/select/queries/${created.id}/revisions`)).json()).items
    expect(revisions.map((r: any) => [r.version, r.action])).toEqual([[2, 'update'], [1, 'create']])
  })

  it('keeps every version, and delete archives (restorable, history kept)', async () => {
    const created = await (await call(selector, 'POST', '/api/select/queries', defaultSavedQuery({ name: '历史 v1' }))).json()
    await call(selector, 'PATCH', `/api/select/queries/${created.id}`, { name: '历史 v2', groups: [{ mode: 'any', filters: [{ key: 'cpe', op: 'lte', value: 3 }] }] })
    await call(admin, 'PATCH', `/api/select/queries/${created.id}`, { hasCollaborated: true, collabCountMin: 1 })

    const removed = await call(selector, 'DELETE', `/api/select/queries/${created.id}`)
    expect(await removed.json()).toEqual({ ok: true, archived: true })
    expect(await ids(selector)).not.toContain(created.id)
    expect(await ids(selector, '?archived=true')).toContain(created.id)
    expect((await call(selector, 'PATCH', `/api/select/queries/${created.id}`, { name: 'x' })).status).toBe(404)
    expect((await call(selector, 'DELETE', `/api/select/queries/${created.id}`)).status).toBe(404)
    const { rows } = await ctx.db.query('SELECT archived_at IS NOT NULL AS archived FROM saved_queries WHERE id = $1', [created.id])
    expect(rows).toEqual([{ archived: true }])

    const restored = await (await call(selector, 'POST', `/api/select/queries/${created.id}/restore`)).json()
    expect(restored).toMatchObject({ name: '历史 v2', version: 5, archivedAt: null, hasCollaborated: true, collabCountMin: 1 })
    expect(await ids(selector)).toContain(created.id)
    expect((await call(selector, 'POST', `/api/select/queries/${created.id}/restore`)).status).toBe(404)

    const revisions = (await (await call(viewer, 'GET', `/api/select/queries/${created.id}/revisions`)).json()).items
    expect(revisions.map((r: any) => [r.version, r.action, r.name, r.editedByName])).toEqual([
      [5, 'restore', '历史 v2', '选人公司'],
      [4, 'archive', '历史 v2', '选人公司'],
      [3, 'update', '历史 v2', '平台管理员'],
      [2, 'update', '历史 v2', '选人公司'],
      [1, 'create', '历史 v1', '选人公司'],
    ])
    expect(revisions[3].spec.groups).toEqual([{ mode: 'any', filters: [{ key: 'cpe', op: 'lte', value: 3 }] }])
    expect(revisions[4].spec.groups).toEqual([])
    expect(revisions[2].spec).toMatchObject({ hasCollaborated: true, collabCountMin: 1, version: 3 })
  })

  it('rejects malformed groups, counts, search and visibility', async () => {
    const bad = [
      [{ groups: [{ mode: 'or', filters: [] }] }, 'groups.shape'],
      [{ groups: [{ mode: 'any', filters: [{ key: 'nope', op: 'gte', value: 1 }] }] }, 'filters.key'],
      [{ groups: [{ mode: 'exclude', filters: [{ key: 'cpe', op: 'percentileGte', value: 101 }] }] }, 'filters.percentile'],
      [{ collabCountMin: 3, collabCountMax: 1 }, 'collabCount'],
      [{ collabCountMin: -1 }, 'collabCount'],
      [{ collabCountMin: 1.5 }, 'collabCount'],
      [{ hasCollaborated: 'yes' }, 'hasCollaborated'],
      [{ categories: [''] }, 'categories'],
      [{ search: 'x'.repeat(101) }, 'search'],
      [{ visibility: 'public' }, 'visibility'],
    ] as const
    for (const [patch, error] of bad) {
      const res = await call(selector, 'POST', '/api/select/queries', { ...defaultSavedQuery({ name: '坏' }), ...patch })
      expect(res.status, JSON.stringify(patch)).toBe(400)
      expect((await res.json()).errors, JSON.stringify(patch)).toContain(error)
    }
  })

  it('seeding twice writes no new version; a changed seed spec gets the next version', async () => {
    const { upsertSavedQuery } = await import('../src/http/saved-queries')
    const { rows: [org] } = await ctx.db.query(`SELECT org_id FROM users WHERE email = 'selector@kcs.local'`)
    const spec = defaultSavedQuery({ id: 'q_seed_twice', name: '种子' })
    await upsertSavedQuery(ctx.db, org.org_id, spec, 'user_selector')
    await upsertSavedQuery(ctx.db, org.org_id, spec, 'user_selector')
    await upsertSavedQuery(ctx.db, org.org_id, { ...spec, tiers: ['mid'] }, 'user_selector')
    const { rows } = await ctx.db.query(
      'SELECT version, action FROM saved_query_revisions WHERE query_id = $1 ORDER BY version',
      ['q_seed_twice'],
    )
    expect(rows).toEqual([{ version: 1, action: 'create' }, { version: 2, action: 'update' }])
  })
})
