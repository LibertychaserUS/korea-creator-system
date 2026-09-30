import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

/**
 * `DELETE /api/select/projects/:id`: own org only, members block the delete,
 * the row and its audit log land or nothing does.
 */
describe('project delete', () => {
  let ctx: TestCtx
  let ops: string
  let sel: string
  let viewer: string

  const auth = (token: string) => ({ authorization: `Bearer ${token}` })
  const del = (id: string, token: string) =>
    ctx.app.request(`/api/select/projects/${id}`, { method: 'DELETE', headers: auth(token) })

  async function newProject(name: string): Promise<string> {
    const res = await ctx.app.request('/api/select/projects', {
      method: 'POST',
      headers: { ...auth(sel), 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    expect(res.status).toBe(201)
    return ((await res.json()) as { id: string }).id
  }

  /** A released creator the selector can assign. */
  async function releasedCreator(name: string): Promise<string> {
    const res = await ctx.app.request('/api/ops/creators', {
      method: 'POST',
      headers: { ...auth(ops), 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: name,
        regions: ['서울'],
        followers: 10000,
        categories: ['never_collaborated'],
      }),
    })
    const { id } = await res.json()
    await ctx.app.request(`/api/ops/creators/${id}/publish`, { method: 'POST', headers: auth(ops) })
    return id as string
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    ops = (await ctx.loginJson('ops@kcs.local')).token
    sel = (await ctx.loginJson('selector@kcs.local')).token
    viewer = (await ctx.loginJson('viewer@kcs.local')).token
  })

  afterAll(() => ctx.close())

  it('403 without select.write, 404 for a project that is not ours', async () => {
    const id = await newProject('只读项目')
    expect((await del(id, viewer)).status).toBe(403)
    expect((await del('no-such-project', sel)).status).toBe(404)
    // Both refusals leave the project in place.
    const still = await ctx.db.query('SELECT id FROM projects WHERE id = $1', [id])
    expect(still.rowCount).toBe(1)
  })

  it('409 while the project has members, 200 once emptied, with an audit row', async () => {
    const id = await newProject('春季档')
    const creatorId = await releasedCreator('可分配达人')
    const assign = await ctx.app.request(`/api/select/projects/${id}/assignments`, {
      method: 'POST',
      headers: { ...auth(sel), 'content-type': 'application/json' },
      body: JSON.stringify({ creatorIds: [creatorId] }),
    })
    expect(assign.status).toBe(200)

    const blocked = await del(id, sel)
    expect(blocked.status).toBe(409)
    expect(((await blocked.json()) as { error: { message: string } }).error.message).toContain('remove its members')

    const unassign = await ctx.app.request(`/api/select/projects/${id}/assignments/${creatorId}`, {
      method: 'DELETE',
      headers: auth(sel),
    })
    expect(unassign.status).toBe(200)

    const removed = await del(id, sel)
    expect(removed.status).toBe(200)
    expect(await ctx.db.query('SELECT 1 FROM projects WHERE id = $1', [id])).toMatchObject({ rowCount: 0 })
    const log = await ctx.db.query(
      "SELECT action, entity_type, entity_id, summary FROM audit_logs WHERE action = 'project.delete' ORDER BY created_at DESC LIMIT 1",
    )
    expect(log.rows[0]).toMatchObject({ action: 'project.delete', entity_type: 'project', entity_id: id, summary: '春季档' })
  })

  it('an empty project deletes straight away', async () => {
    const id = await newProject('空项目')
    expect((await del(id, sel)).status).toBe(200)
    expect(await ctx.db.query('SELECT 1 FROM projects WHERE id = $1', [id])).toMatchObject({ rowCount: 0 })
  })
})
