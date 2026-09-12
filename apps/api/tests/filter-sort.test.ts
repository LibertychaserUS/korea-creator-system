import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('select pool filter and sort', () => {
  let ctx: TestCtx
  let token: string

  beforeAll(async () => {
    ctx = await createTestApp()
    const ops = await ctx.loginJson('ops@kcs.local')
    const people = [
      {
        displayName: '高粉合作',
        followers: 200000,
        rating: 4.9,
        categories: ['collaborated'],
        collaborations: [{ brand: '兰芝' }],
        price: { amountMin: 9000, currency: 'CNY' },
        regions: ['上海'],
      },
      {
        displayName: '低粉未合作',
        followers: 3000,
        rating: 3.1,
        categories: ['never_collaborated'],
        price: { amountMin: 2000, currency: 'CNY' },
        regions: ['北京'],
      },
      {
        displayName: '中粉无评分',
        followers: 50000,
        categories: ['intending', 'never_collaborated'],
        price: { amountMin: 5000, currency: 'CNY' },
        regions: ['杭州'],
      },
    ]
    for (const person of people) {
      const created = await ctx.app.request('/api/ops/creators', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${ops.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(person),
      })
      const { id } = await created.json()
      await ctx.app.request(`/api/ops/creators/${id}/publish`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ops.token}` },
      })
    }
    token = (await ctx.loginJson('selector@kcs.local')).token
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('defaults to computed score desc instead of the raw rating column', async () => {
    const res = await ctx.app.request('/api/select/pool', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    const wanted = new Set(['高粉合作', '低粉未合作', '中粉无评分'])
    const rows = body.items.filter((row: { displayName: string }) => wanted.has(row.displayName))
    expect(rows.map((row: { displayName: string }) => row.displayName)).toEqual([
      '高粉合作',
      '中粉无评分',
      '低粉未合作',
    ])
    expect(rows.map((row: { final: number }) => row.final)).toEqual(
      [...rows].map((row: { final: number }) => row.final).sort((a: number, b: number) => b - a),
    )
  })

  it('keeps order=asc semantics for computed score', async () => {
    const res = await ctx.app.request('/api/select/pool?sort=rating&order=asc', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    const wanted = new Set(['高粉合作', '低粉未合作', '中粉无评分'])
    const rows = body.items.filter((row: { displayName: string }) => wanted.has(row.displayName))
    expect(rows.map((row: { displayName: string }) => row.displayName)).toEqual([
      '低粉未合作',
      '中粉无评分',
      '高粉合作',
    ])
  })

  it('filters by follower range, collaboration, and overlapping price', async () => {
    const res = await ctx.app.request(
      '/api/select/pool?followersMin=10000&hasCollaborated=true&priceMin=8000&priceMax=10000&currency=CNY',
      { headers: { authorization: `Bearer ${token}` } },
    )
    const body = await res.json()
    expect(body.items.map((row: { displayName: string }) => row.displayName)).toEqual(['高粉合作'])
  })

  it('sorts by price min ascending and sinks missing prices last', async () => {
    const res = await ctx.app.request('/api/select/pool?sort=price&order=asc', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    expect(body.items[0].displayName).toBe('低粉未合作')
  })

  it('filters by rule grade and collab brand', async () => {
    const all = await ctx.app.request('/api/select/pool', {
      headers: { authorization: `Bearer ${token}` },
    })
    const high = (await all.json()).items.find((row: { displayName: string }) => row.displayName === '高粉合作')
    expect(high.grade).toMatch(/^[SABC]$/)

    const byGrade = await ctx.app.request(`/api/select/pool?grade=${high.grade}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((await byGrade.json()).items.map((row: { displayName: string }) => row.displayName)).toContain(
      '高粉合作',
    )

    const byBrand = await ctx.app.request('/api/select/pool?brand=兰芝', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((await byBrand.json()).items.map((row: { displayName: string }) => row.displayName)).toEqual([
      '高粉合作',
    ])
  })
})
