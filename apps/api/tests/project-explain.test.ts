import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultSavedQuery } from '@kcs/contract'
import { createTestApp, type TestCtx } from './helpers'

/**
 * 0 结果归因：4 位带唯一标记 EXPL 的达人（粉丝量分别落在
 * junior/junior/mid/head），直接库查基线 + 命中数断言每个单条件 count。
 */
describe('project explain', () => {
  let ctx: TestCtx
  let ops: string
  let selector: string
  let projectId: string
  const ids: string[] = []
  let base: { search: number; cpe: number; er: number; followers: number; region: number; tier: number }

  const call = (token: string, method: string, path: string, body?: unknown) =>
    ctx.app.request(path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

  const baseline = async (where: string): Promise<number> => {
    const { rows } = await ctx.db.query(
      `SELECT count(*)::int AS n FROM creator_published WHERE NOT blacklisted AND ${where}`,
    )
    return rows[0].n
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    ops = (await ctx.loginJson('ops@kcs.local')).token
    selector = (await ctx.loginJson('selector@kcs.local')).token

    // 基线在夹具入库前量好：期望 = 基线 + 夹具命中数。
    base = {
      search: await baseline(`strpos(lower(concat_ws(' ', display_name, creator_key, xhs_id)), 'expl') > 0`),
      cpe: await baseline('m_cpe <= 2'),
      er: await baseline('m_engagement_rate >= 4'),
      followers: await baseline('m_followers BETWEEN 5000 AND 400000'),
      region: await baseline(`regions && '{上海}'::text[]`),
      tier: await baseline(`tier = ANY('{junior,mid}')`),
    }

    const fixtures = [
      { name: '归因甲EXPL', followers: 6000, regions: ['上海'], metrics: { cpe: 0.5, engagementRate: 6 } },
      { name: '归因乙EXPL', followers: 20000, regions: ['上海'], metrics: { cpe: 1.5, engagementRate: 5 } },
      { name: '归因丙EXPL', followers: 300000, regions: ['上海'], metrics: { cpe: 2.5, engagementRate: 4 } },
      { name: '归因丁EXPL', followers: 600000, regions: ['归因专区'], metrics: { cpe: 3.5, engagementRate: 3 } },
    ]
    for (const fixture of fixtures) {
      const res = await call(ops, 'POST', '/api/ops/creators', {
        displayName: fixture.name,
        followers: fixture.followers,
        regions: fixture.regions,
        categories: ['never_collaborated'],
        metrics: fixture.metrics,
      })
      expect(res.status).toBe(201)
      const { id } = await res.json()
      ids.push(id)
      const published = await call(ops, 'POST', `/api/ops/creators/${id}/publish`)
      expect(published.status).toBe(200)
    }

    const created = await call(selector, 'POST', '/api/select/projects', { name: '归因任务' })
    expect(created.status).toBe(201)
    projectId = (await created.json()).id
  })

  afterAll(() => ctx.close())

  it('counts the full spec and each clause on its own', async () => {
    const spec = defaultSavedQuery({
      name: '归因测试',
      search: 'EXPL',
      filters: [
        { key: 'cpe', op: 'lte', value: 2 },
        { key: 'engagementRate', op: 'gte', value: 4 },
        { key: 'followers', op: 'between', value: [5000, 400000] },
      ],
      regions: ['上海'],
      tiers: ['junior', 'mid'],
    })
    const res = await call(selector, 'POST', `/api/select/projects/${projectId}/explain`, { spec })
    expect(res.status).toBe(200)
    const body = await res.json()

    // 完整 spec：甲、乙命中；丙 cpe 2.5 超限，丁地区/档位/粉丝都不在区间内。
    expect(body.total).toBe(base.search + 2)
    const byKey = Object.fromEntries(body.clauses.map((c: { key: string; count: number }) => [c.key, c.count]))
    expect(byKey.search).toBe(base.search + 4)
    expect(byKey['filters.cpe']).toBe(base.cpe + 2)
    expect(byKey['filters.engagementRate']).toBe(base.er + 3)
    expect(byKey['filters.followers']).toBe(base.followers + 3)
    expect(byKey.region).toBe(base.region + 3)
    expect(byKey.tier).toBe(base.tier + 3)
    expect(body.clauses).toHaveLength(6)
  })

  it('explains a single-condition spec (total equals the one clause)', async () => {
    const spec = defaultSavedQuery({ name: '只有搜索', search: '归因丙' })
    const res = await call(selector, 'POST', `/api/select/projects/${projectId}/explain`, { spec })
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.clauses).toEqual([{ key: 'search', count: 1 }])
  })

  it('rejects an invalid spec with field errors', async () => {
    const res = await call(selector, 'POST', `/api/select/projects/${projectId}/explain`, {
      spec: { filters: 'nope' },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION')
    expect(body.error.message).toBe('invalid_query')
    expect(body.error.fields).toContainEqual({ path: 'filters', message: 'filters.shape' })
  })

  it('404s a project the org does not have', async () => {
    const res = await call(selector, 'POST', '/api/select/projects/nope/explain', {
      spec: defaultSavedQuery({ name: 'x', search: 'EXPL' }),
    })
    expect(res.status).toBe(404)
  })
})
