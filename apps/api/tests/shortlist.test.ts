import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('select shortlist prices', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('returns API price fields so the shortlist can total quotes', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const created = await ctx.app.request('/api/ops/creators', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ops.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        displayName: '短名单报价人',
        regions: ['上海'],
        followers: 80000,
        categories: ['never_collaborated'],
        price: { amountMin: 8000, amountMax: 12000, currency: 'CNY' },
      }),
    })
    const { id } = await created.json()
    await ctx.app.request(`/api/ops/creators/${id}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${ops.token}` },
    })

    const sel = await ctx.loginJson('selector@kcs.local')
    const added = await ctx.app.request('/api/select/shortlist', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${sel.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ creatorId: id }),
    })
    expect(added.status).toBe(200)

    const list = await ctx.app.request('/api/select/shortlist', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    expect(list.status).toBe(200)
    const body = await list.json()
    const row = body.items.find((item: { creatorId?: string }) => {
      return item.creatorId === id
    })
    expect(row).toBeTruthy()
    expect(row.price?.amountMin).toBe(8000)
    expect(row.price?.currency).toBe('CNY')
  })
})
