import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('creator publish and visibility', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('keeps draft creators out of the select pool', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const created = await ctx.app.request('/api/ops/creators', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ops.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        displayName: '未发布的人',
        regions: ['부산'],
        followers: 12000,
        categories: ['never_collaborated'],
      }),
    })
    expect(created.status).toBe(201)
    const { id } = await created.json()
    const sel = await ctx.loginJson('selector@kcs.local')
    const pool = await ctx.app.request('/api/select/pool', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    expect(pool.status).toBe(200)
    const body = await pool.json()
    expect(body.items.some((row: { id: string }) => row.id === id)).toBe(false)
    const detail = await ctx.app.request(`/api/select/creators/${id}`, {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    expect(detail.status).toBe(404)
  })

  it('publishes a ready creator into the select pool', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const created = await ctx.app.request('/api/ops/creators', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ops.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        displayName: '可发布的人',
        regions: ['서울'],
        verticals: ['beauty'],
        followers: 88000,
        rating: 4.6,
        categories: ['collaborated'],
        collaborations: [{ brand: '설화수' }],
        price: { amountMin: 8000, amountMax: 12000, currency: 'CNY' },
      }),
    })
    const { id } = await created.json()
    const pub = await ctx.app.request(`/api/ops/creators/${id}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${ops.token}` },
    })
    expect(pub.status).toBe(200)
    const sel = await ctx.loginJson('selector@kcs.local')
    const pool = await ctx.app.request('/api/select/pool', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    const body = await pool.json()
    expect(body.items.some((row: { displayName: string }) => row.displayName === '可发布的人')).toBe(
      true,
    )
  })

  it('hides blacklisted creators from the pool even if released', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const created = await ctx.app.request('/api/ops/creators', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ops.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        displayName: '黑名单的人',
        regions: ['서울'],
        followersUnknown: true,
        categories: ['collaborated', 'blacklist'],
      }),
    })
    const { id } = await created.json()
    await ctx.app.request(`/api/ops/creators/${id}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${ops.token}` },
    })
    const sel = await ctx.loginJson('selector@kcs.local')
    const pool = await ctx.app.request('/api/select/pool', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    const body = await pool.json()
    expect(body.items.some((row: { id: string }) => row.id === id)).toBe(false)
  })
})
