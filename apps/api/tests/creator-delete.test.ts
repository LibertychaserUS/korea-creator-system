import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

/**
 * `DELETE /api/ops/creators/:id`: drafts die with every side record in one
 * transaction; a released creator is 409 until unpublished.
 */
describe('creator delete', () => {
  let ctx: TestCtx
  let ops: string
  let viewer: string

  const auth = (token: string) => ({ authorization: `Bearer ${token}` })
  const del = (id: string, token: string) =>
    ctx.app.request(`/api/ops/creators/${id}`, { method: 'DELETE', headers: auth(token) })

  async function newCreator(name: string): Promise<string> {
    const res = await ctx.app.request('/api/ops/creators', {
      method: 'POST',
      headers: { ...auth(ops), 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: name,
        regions: ['서울'],
        followers: 10000,
        categories: ['never_collaborated'],
        price: { amountMin: 3500, currency: 'CNY' },
      }),
    })
    expect(res.status).toBe(201)
    return ((await res.json()) as { id: string }).id
  }

  async function sideCounts(creatorId: string) {
    const tables = [
      'creator_categories',
      'collaborations',
      'prices',
      'reviews',
      'creator_raw',
      'creator_sources',
      'creator_metrics_history',
      'creator_published',
      'assignments',
      'shortlist_items',
    ]
    const counts = await Promise.all(
      tables.map(async (table) => ({
        table,
        n: (await ctx.db.query(`SELECT count(*)::int AS n FROM ${table} WHERE creator_id = $1`, [creatorId])).rows[0].n as number,
      })),
    )
    return Object.fromEntries(counts.map(({ table, n }) => [table, n]))
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    ops = (await ctx.loginJson('ops@kcs.local')).token
    viewer = (await ctx.loginJson('viewer@kcs.local')).token
  })

  afterAll(() => ctx.close())

  it('403 without ops.write, 404 for a missing creator', async () => {
    const id = await newCreator('待删甲')
    expect((await del(id, viewer)).status).toBe(403)
    expect((await del('no-such-creator', ops)).status).toBe(404)
    const still = await ctx.db.query('SELECT 1 FROM creators WHERE id = $1', [id])
    expect(still.rowCount).toBe(1)
  })

  it('409 for a released creator, until they are unpublished', async () => {
    const id = await newCreator('已上架的')
    await ctx.app.request(`/api/ops/creators/${id}/publish`, { method: 'POST', headers: auth(ops) })
    const blocked = await del(id, ops)
    expect(blocked.status).toBe(409)
    expect(((await blocked.json()) as { error: { message: string } }).error.message).toContain('unpublish')
    const still = await ctx.db.query('SELECT status FROM creators WHERE id = $1', [id])
    expect(still.rows[0]).toEqual({ status: 'released' })

    await ctx.app.request(`/api/ops/creators/${id}/unpublish`, { method: 'POST', headers: auth(ops) })
    expect((await del(id, ops)).status).toBe(200)
  })

  it('a draft deletes with its child rows in every side table, and writes audit', async () => {
    const id = await newCreator('连根删除')
    // Sheet-style side records beyond what POST creates.
    await ctx.db.query(
      `INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload)
       VALUES ('cd_raw', $1, 'qiangua', 'cd_1', now(), '{}')`,
      [id],
    )
    await ctx.db.query(
      `INSERT INTO creator_sources (creator_id, source, external_id) VALUES ($1, 'qiangua', 'cd_1')`,
      [id],
    )
    await ctx.db.query(
      `INSERT INTO creator_metrics_history (id, creator_id, source, "window", fetched_at, metrics)
       VALUES ('cd_hist', $1, 'qiangua', 30, now(), '{}')`,
      [id],
    )
    await ctx.db.query(
      `INSERT INTO reviews (id, creator_id, risk_level, conclusion, status)
       VALUES ('cd_review', $1, 'low', '文件投递待校对', 'pending')`,
      [id],
    )
    // shortlist has no cascade and no reviews-table row: a selector bookmark.
    await ctx.db.query(
      `INSERT INTO shortlist_items (org_id, creator_id) VALUES ('org_platform', $1)`,
      [id],
    )
    expect(await sideCounts(id)).toMatchObject({
      creator_categories: 1,
      prices: 1,
      reviews: 1,
      creator_raw: 1,
      creator_sources: 1,
      creator_metrics_history: 1,
      shortlist_items: 1,
    })

    const res = await del(id, ops)
    expect(res.status).toBe(200)
    expect(await sideCounts(id)).toEqual({
      creator_categories: 0,
      collaborations: 0,
      prices: 0,
      reviews: 0,
      creator_raw: 0,
      creator_sources: 0,
      creator_metrics_history: 0,
      creator_published: 0,
      assignments: 0,
      shortlist_items: 0,
    })
    expect(await ctx.db.query('SELECT 1 FROM creators WHERE id = $1', [id])).toMatchObject({ rowCount: 0 })
    const log = await ctx.db.query(
      "SELECT action, entity_type, entity_id, summary FROM audit_logs WHERE action = 'creator.delete' ORDER BY created_at DESC LIMIT 1",
    )
    expect(log.rows[0]).toMatchObject({ action: 'creator.delete', entity_type: 'creator', entity_id: id, summary: '连根删除' })
  })

  it('a ready (passed, unpublished) creator can also be deleted', async () => {
    const id = await newCreator('已通过待删')
    await ctx.app.request(`/api/ops/review/${id}/pass`, { method: 'POST', headers: auth(ops) })
    expect((await del(id, ops)).status).toBe(200)
    expect(await ctx.db.query('SELECT 1 FROM creators WHERE id = $1', [id])).toMatchObject({ rowCount: 0 })
  })
})
