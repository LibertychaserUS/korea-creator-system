import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('project workspace', () => {
  let ctx: TestCtx
  let ops: string
  let selector: string
  let viewer: string
  let projectId: string
  let creatorA: string
  let creatorB: string

  const call = (token: string, method: string, path: string, body?: unknown) =>
    ctx.app.request(path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

  const makeCreator = async (body: Record<string, unknown>) => {
    const res = await call(ops, 'POST', '/api/ops/creators', body)
    expect(res.status).toBe(201)
    const { id } = await res.json()
    const published = await call(ops, 'POST', `/api/ops/creators/${id}/publish`)
    expect(published.status).toBe(200)
    return id as string
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    ops = (await ctx.loginJson('ops@kcs.local')).token
    selector = (await ctx.loginJson('selector@kcs.local')).token
    viewer = (await ctx.loginJson('viewer@kcs.local')).token

    creatorA = await makeCreator({
      displayName: '空间甲',
      followers: 10000,
      regions: ['上海'],
      categories: ['never_collaborated'],
      price: { amountMin: 3500, currency: 'CNY' },
      metrics: { engagementRate: 5.5, readMedian: 12000, cpr: 8, cpe: 2 },
    })
    creatorB = await makeCreator({
      displayName: '空间乙',
      followers: 60000,
      regions: ['北京'],
      categories: ['never_collaborated'],
      metrics: { engagementRate: 3, readMedian: 50000, cpr: 20, cpe: 5 },
    })
    // Deterministic ranks / 分位 for A; B keeps an empty ranks object.
    await ctx.db.query(
      `UPDATE creator_published
          SET ranks = '{"engagementRate": {"percentile": 72.3, "band": "good", "n": 42, "scope": "library"}}'::jsonb
        WHERE creator_id = $1`,
      [creatorA],
    )

    const created = await call(selector, 'POST', '/api/select/projects', {
      name: '工作区任务',
      brief: { category: '美妆', targetCount: 10, deadline: '2026-12-01' },
    })
    expect(created.status).toBe(201)
    projectId = (await created.json()).id
    for (const creatorId of [creatorA, creatorB]) {
      const assigned = await call(selector, 'POST', `/api/select/projects/${projectId}/assignments`, {
        creatorIds: [creatorId],
      })
      expect(assigned.status).toBe(200)
    }
    // B joined later but already left the pool: decided for A, gone for B.
    await ctx.db.query(
      `UPDATE assignments SET assigned_at = '2026-09-01T00:00:00Z', status = 'decided'
        WHERE project_id = $1 AND creator_id = $2`,
      [projectId, creatorA],
    )
    await ctx.db.query(
      `UPDATE assignments SET assigned_at = '2026-09-02T00:00:00Z', pool_gone = true
        WHERE project_id = $1 AND creator_id = $2`,
      [projectId, creatorB],
    )
    await ctx.db.query('DELETE FROM creator_published WHERE creator_id = $1', [creatorB])
  })

  afterAll(() => ctx.close())

  it('aggregates mission, funnel, basket and pool coverage', async () => {
    const res = await call(selector, 'GET', `/api/select/projects/${projectId}/workspace`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.mission).toEqual({
      id: projectId,
      name: '工作区任务',
      note: null,
      status: 'open',
      brief: { category: '美妆', targetCount: 10, deadline: '2026-12-01' },
      createdAt: expect.any(String),
      deadlineFromBrief: '2026-12-01',
    })
    expect(body.funnel).toEqual({ basket: 2, decided: 1 })

    // 按 assigned_at DESC：B 在后加入，排第一。
    expect(body.basket).toHaveLength(2)
    const [b, a] = body.basket
    expect(b).toEqual({
      creatorId: creatorB,
      displayName: '空间乙',
      followers: 60000,
      tier: 'mid',
      priceImage: null,
      source: null,
      metrics: { engagementRate: null, readMedian: null, cpr: null, cpe: null },
      percentiles: { engagementRate: null },
      assignmentStatus: 'assigned',
      addedAt: '2026-09-02T00:00:00.000Z',
      poolGone: true,
    })
    expect(a).toEqual({
      creatorId: creatorA,
      displayName: '空间甲',
      followers: 10000,
      tier: 'junior',
      priceImage: 3500,
      source: null,
      metrics: { engagementRate: 5.5, readMedian: 12000, cpr: 8, cpe: 2 },
      percentiles: { engagementRate: 72.3 },
      assignmentStatus: 'decided',
      addedAt: '2026-09-01T00:00:00.000Z',
      poolGone: false,
    })

    const { rows } = await ctx.db.query(
      'SELECT count(*)::int AS n FROM creator_published WHERE NOT blacklisted',
    )
    expect(body.coverage).toEqual({ poolTotal: rows[0].n })
  })

  it('404s a project the org does not have and lets the viewer read', async () => {
    const missing = await call(selector, 'GET', '/api/select/projects/nope/workspace')
    expect(missing.status).toBe(404)
    const asViewer = await call(viewer, 'GET', `/api/select/projects/${projectId}/workspace`)
    expect(asViewer.status).toBe(200)
  })

  it('still serves the plain detail endpoint with the brief on it', async () => {
    const res = await call(selector, 'GET', `/api/select/projects/${projectId}`)
    const body = await res.json()
    expect(body.brief).toEqual({ category: '美妆', targetCount: 10, deadline: '2026-12-01' })
    expect(body.assignments).toHaveLength(2)
  })
})
