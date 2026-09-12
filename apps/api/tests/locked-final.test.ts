import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('locked published finals', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('does not change a published final when proofed fields later change', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const created = await ctx.app.request('/api/ops/creators', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ops.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        displayName: '锁定分达人',
        regions: ['서울'],
        followers: 12000,
        categories: ['never_collaborated'],
        price: { amountMin: 4000, currency: 'CNY' },
      }),
    })
    const { id } = await created.json()
    await ctx.app.request(`/api/ops/creators/${id}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${ops.token}` },
    })

    const sel = await ctx.loginJson('selector@kcs.local')
    const before = await ctx.app.request('/api/select/pool', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    const row = (await before.json()).items.find((item: { id: string }) => item.id === id)
    expect(row.final).toEqual(expect.any(Number))
    const locked = row.final

    await ctx.app.request(`/api/ops/creators/${id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${ops.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ followers: 2_000_000 }),
    })

    const after = await ctx.app.request('/api/select/pool', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    const again = (await after.json()).items.find((item: { id: string }) => item.id === id)
    expect(again.final).toBe(locked)
  })
})
