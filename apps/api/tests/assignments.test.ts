import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('project assignment', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('assigns a released creator once and can remove them', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const created = await ctx.app.request('/api/ops/creators', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ops.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        displayName: '待分配',
        regions: ['서울'],
        followers: 10000,
        categories: ['never_collaborated'],
        price: { amountMin: 3500, currency: 'CNY' },
      }),
    })
    const { id: creatorId } = await created.json()
    await ctx.app.request(`/api/ops/creators/${creatorId}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${ops.token}` },
    })
    const sel = await ctx.loginJson('selector@kcs.local')
    const project = await ctx.app.request('/api/select/projects', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${sel.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '春季档' }),
    })
    expect(project.status).toBe(201)
    const { id: projectId } = await project.json()
    const first = await ctx.app.request(`/api/select/projects/${projectId}/assignments`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${sel.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ creatorIds: [creatorId] }),
    })
    expect(first.status).toBe(200)
    const dup = await ctx.app.request(`/api/select/projects/${projectId}/assignments`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${sel.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ creatorIds: [creatorId] }),
    })
    expect(dup.status).toBe(409)
    const board = await ctx.app.request(`/api/select/projects/${projectId}`, {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    const boardBody = await board.json()
    expect(boardBody.assignments).toHaveLength(1)
    expect(boardBody.assignments[0].price?.amountMin).toBe(3500)
    expect(boardBody.assignments[0].rank).toBeGreaterThan(0)
    const remove = await ctx.app.request(
      `/api/select/projects/${projectId}/assignments/${creatorId}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${sel.token}` } },
    )
    expect(remove.status).toBe(200)
    const again = await ctx.app.request(`/api/select/projects/${projectId}`, {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    expect((await again.json()).assignments).toHaveLength(0)
  })
})
