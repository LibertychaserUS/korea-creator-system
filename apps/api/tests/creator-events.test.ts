import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CREATOR_EVENT_KINDS } from '@kcs/contract'
import { createTestApp, type TestCtx } from './helpers'
import { readEvents, recordEvents } from '../src/http/events'

/**
 * Break: a publish / take-down / assignment / removal / export / detail view
 * stops leaving an event, a failed action leaves one, a refresh of the detail
 * page counts twice, or the history disappears with the creator row.
 */
describe('outcome events', () => {
  let ctx: TestCtx
  let ops: string
  let selector: string
  let admin: string
  const tag = `evt${Date.now()}`

  const call = (token: string, method: string, path: string, body?: unknown) =>
    ctx.app.request(path, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  const events = async (creatorId: string) =>
    (await readEvents(ctx.db, { creatorIds: [creatorId] })).reverse().map((e) => ({
      kind: e.kind, actorId: e.actorId, projectId: e.projectId, source: e.source, context: e.context,
    }))

  async function create(name: string, publish = true): Promise<string> {
    const res = await call(ops, 'POST', '/api/ops/creators', {
      displayName: name,
      source: 'pugongying',
      externalId: name,
      regions: [tag],
      verticals: ['test'],
      metrics: { window: 30, followers: 20_000, readMedian: 5_000 },
    })
    expect(res.status).toBe(201)
    const { id } = await res.json()
    if (publish) expect((await call(ops, 'POST', `/api/ops/creators/${id}/publish`)).status).toBe(200)
    return id
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    ops = (await ctx.loginJson('ops@kcs.local')).token
    selector = (await ctx.loginJson('selector@kcs.local')).token
    admin = (await ctx.loginJson('admin@kcs.local')).token
  })
  afterAll(() => ctx.close())

  it('publish, a repeated publish (no-op), take-down and republish', async () => {
    const id = await create(`${tag}-发布`)
    expect((await call(ops, 'POST', `/api/ops/creators/${id}/publish`)).status).toBe(200)
    expect((await call(ops, 'POST', `/api/ops/creators/${id}/unpublish`)).status).toBe(200)
    expect((await call(ops, 'POST', `/api/ops/creators/${id}/publish`)).status).toBe(200)
    expect(await events(id)).toEqual([
      { kind: 'publish', actorId: 'user_ops', projectId: null, source: 'pugongying', context: { republish: false } },
      { kind: 'unpublish', actorId: 'user_ops', projectId: null, source: 'pugongying', context: {} },
      { kind: 'publish', actorId: 'user_ops', projectId: null, source: 'pugongying', context: { republish: true } },
    ])
    expect((await call(ops, 'POST', `/api/ops/creators/missing-${tag}/unpublish`)).status).toBe(404)
    expect(await readEvents(ctx.db, { creatorIds: [`missing-${tag}`] })).toEqual([])
  })

  it('assign, a rejected assign, export per creator, and removal from a project', async () => {
    const a = await create(`${tag}-甲`)
    const b = await create(`${tag}-乙`)
    const project = await (await call(selector, 'POST', '/api/select/projects', { name: `${tag} 项目` })).json()
    expect((await call(selector, 'POST', `/api/select/projects/${project.id}/assignments`, { creatorIds: [a, b] })).status).toBe(200)
    expect((await call(selector, 'POST', `/api/select/projects/${project.id}/assignments`, { creatorIds: [a] })).status).toBe(409)
    const exported = await call(selector, 'GET', `/api/select/projects/${project.id}/export?locale=en`)
    expect(exported.status).toBe(200)
    expect((await call(selector, 'DELETE', `/api/select/projects/${project.id}/assignments/${b}`)).status).toBe(200)
    expect((await call(selector, 'DELETE', `/api/select/projects/${project.id}/assignments/${b}`)).status).toBe(404)

    const onProject = (e: { projectId: string | null }) => e.projectId === project.id
    expect((await events(a)).filter(onProject)).toEqual([
      { kind: 'assign', actorId: 'user_selector', projectId: project.id, source: 'pugongying', context: { projectId: project.id } },
      { kind: 'export', actorId: 'user_selector', projectId: project.id, source: 'pugongying', context: { projectId: project.id, locale: 'en' } },
    ])
    expect((await events(b)).filter(onProject).map((e) => e.kind)).toEqual(['assign', 'export', 'unassign'])
  })

  it('a detail view counts once per person within 10 minutes; each person counts', async () => {
    const id = await create(`${tag}-详情`)
    for (let i = 0; i < 3; i += 1) expect((await call(selector, 'GET', `/api/select/creators/${id}`)).status).toBe(200)
    expect((await call(admin, 'GET', `/api/select/creators/${id}`)).status).toBe(200)
    const views = (await events(id)).filter((e) => e.kind === 'detail_view')
    expect(views.map((e) => e.actorId)).toEqual(['user_selector', 'user_platform_admin'])

    await ctx.db.query(
      `UPDATE creator_events SET occurred_at = now() - interval '11 minutes' WHERE creator_id = $1 AND kind = 'detail_view'`,
      [id],
    )
    await call(selector, 'GET', `/api/select/creators/${id}`)
    expect((await events(id)).filter((e) => e.kind === 'detail_view')).toHaveLength(3)
  })

  it('a failing event write does not fail the detail page', async () => {
    const id = await create(`${tag}-写失败`)
    await ctx.db.query(`ALTER TABLE creator_events ADD CONSTRAINT evt_test_no_views CHECK (kind <> 'detail_view') NOT VALID`)
    try {
      expect((await call(selector, 'GET', `/api/select/creators/${id}`)).status).toBe(200)
    } finally {
      await ctx.db.query('ALTER TABLE creator_events DROP CONSTRAINT evt_test_no_views')
    }
    expect((await events(id)).map((e) => e.kind)).toEqual(['publish'])
  })

  it('a creator hidden from the pool leaves no view; the history outlives the creator row', async () => {
    const hidden = await create(`${tag}-未发布`, false)
    expect((await call(selector, 'GET', `/api/select/creators/${hidden}`)).status).toBe(404)
    expect(await events(hidden)).toEqual([])

    const gone = await create(`${tag}-被合并`)
    await ctx.db.query('DELETE FROM creators WHERE id = $1', [gone])
    expect((await events(gone)).map((e) => e.kind)).toEqual(['publish'])
  })

  it('the table accepts exactly the contract kinds', async () => {
    for (const kind of CREATOR_EVENT_KINDS) expect(await recordEvents(ctx.db, [{ kind, creatorId: `k-${tag}`, actorId: kind }])).toBe(1)
    await expect(recordEvents(ctx.db, [{ kind: 'rank' as never, creatorId: `k-${tag}` }])).rejects.toThrow(/check constraint/)
  })

  it('readEvents narrows by kind and time; recordEvents fills the source from the creator', async () => {
    const id = await create(`${tag}-读`)
    expect(await recordEvents(ctx.db, [{ kind: 'assign', creatorId: id, projectId: 'p_x' }, { kind: 'assign', creatorId: `none-${tag}` }])).toBe(2)
    const assigns = await readEvents(ctx.db, { creatorIds: [id, `none-${tag}`], kinds: ['assign'] })
    expect(assigns.map((e) => [e.creatorId, e.source]).sort()).toEqual([[id, 'pugongying'], [`none-${tag}`, null]].sort())
    expect(await readEvents(ctx.db, { creatorIds: [id], since: new Date(Date.now() + 60_000) })).toEqual([])
    expect(await readEvents(ctx.db, { creatorIds: [id], limit: 1 })).toHaveLength(1)
  })
})
