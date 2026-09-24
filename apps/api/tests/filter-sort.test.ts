import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('select pool metric filters and sort', () => {
  let ctx: TestCtx
  let token: string

  beforeAll(async () => {
    ctx = await createTestApp()
    const ops = await ctx.loginJson('ops@kcs.local')
    for (const person of [
      { displayName: '指标甲', followers: 200_000, cpe: 4.2, health: 'abnormal', source: 'pugongying' },
      { displayName: '指标乙', followers: 30_000, cpe: 1.8, health: 'healthy', source: 'qiangua' },
      { displayName: '指标丙', followers: 3_000, cpe: 2.7, health: 'healthy', source: 'xinhong' },
    ]) {
      const created = await ctx.app.request('/api/ops/creators', {
        method: 'POST',
        headers: { authorization: `Bearer ${ops.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: person.displayName,
          followers: person.followers,
          source: person.source,
          regions: ['测试指标区'],
          verticals: ['metric-test'],
          categories: ['never_collaborated'],
          metrics: {
            window: 30,
            followers: person.followers,
            cpe: person.cpe,
            health: person.health,
            readMedian: person.followers / 4,
            interactionMedian: person.followers / 50,
          },
        }),
      })
      const { id } = await created.json()
      await ctx.app.request(`/api/ops/creators/${id}/publish`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ops.token}` },
      })
    }
    token = (await ctx.loginJson('selector@kcs.local')).token
  })

  afterAll(() => ctx.close())

  async function rows(query = '') {
    const res = await ctx.app.request(`/api/select/pool?region=测试指标区${query}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    return (await res.json()).items
  }

  it('defaults to cpe ascending with no score fields', async () => {
    const result = await rows()
    expect(result.map((row: { displayName: string }) => row.displayName)).toEqual(['指标乙', '指标丙', '指标甲'])
    expect(result[0]).not.toHaveProperty('grade')
    expect(result[0]).not.toHaveProperty('final')
    expect(result[0]).toMatchObject({ source: 'qiangua', tier: 'junior', health: 'healthy' })
  })

  it('sorts any numeric metric and supports order', async () => {
    const result = await rows('&sort=followers&order=desc')
    expect(result.map((row: { displayName: string }) => row.displayName)).toEqual(['指标甲', '指标乙', '指标丙'])
  })

  it('filters tier, health, source and metric bounds with AND semantics', async () => {
    const result = await rows('&tier=junior&health=healthy&source=qiangua&cpeMax=2')
    expect(result.map((row: { displayName: string }) => row.displayName)).toEqual(['指标乙'])
  })

  it('keeps category and brand filters', async () => {
    const result = await rows('&category=metric-test')
    expect(result).toHaveLength(3)
    const none = await rows('&brand=不存在品牌')
    expect(none).toEqual([])
  })

  it('returns derived metrics and tier-cohort percentiles', async () => {
    const result = await rows()
    expect(result.every((row: { metrics: { engagementRate: number } }) => row.metrics.engagementRate > 0)).toBe(true)
    expect(result.every((row: { percentiles: object }) => typeof row.percentiles === 'object')).toBe(true)
  })
})
