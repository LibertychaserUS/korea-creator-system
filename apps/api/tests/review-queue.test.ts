import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

/**
 * Break: the review queue drifts from who is actually waiting — ingest marks
 * creators needs_review without ever opening a reviews row, so the list must
 * read the creators table, and pass must work on every creator it shows.
 */
describe('ops review queue', () => {
  let ctx: TestCtx
  let ops: string
  let viewer: string

  const auth = (token: string) => ({ authorization: `Bearer ${token}` })

  beforeAll(async () => {
    ctx = await createTestApp()
    ops = (await ctx.loginJson('ops@kcs.local')).token
    viewer = (await ctx.loginJson('viewer@kcs.local')).token
    // An ingested creator: needs_review, no reviews row, raw payload on file.
    await ctx.db.query(
      `INSERT INTO creators (id, creator_key, display_name, status, needs_review, followers, verticals, source, external_id)
       VALUES ('rv_ingested', 'rv_ingested', '抓取的达人', 'draft', true, 50000, '{护肤}', 'qiangua', 'qg_1')`,
    )
    await ctx.db.query(
      `INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload)
       VALUES ('rv_raw', 'rv_ingested', 'qiangua', 'qg_1', now(), '{}')`,
    )
    // A sheet creator: needs_review with a pending reviews row, no raw payload.
    await ctx.db.query(
      `INSERT INTO creators (id, creator_key, display_name, status, needs_review, followers, verticals)
       VALUES ('rv_sheet', 'rv_sheet', '表格投递', 'draft', true, 8000, '{}')`,
    )
    await ctx.db.query(
      `INSERT INTO reviews (id, creator_id, risk_level, conclusion, status)
       VALUES ('rv_row', 'rv_sheet', 'low', '文件投递待校对', 'pending')`,
    )
    // Not waiting: already cleared, and released.
    await ctx.db.query(
      `INSERT INTO creators (id, creator_key, display_name, status, needs_review)
       VALUES ('rv_cleared', 'rv_cleared', '已通过的', 'ready', false)`,
    )
    await ctx.db.query(
      `INSERT INTO creators (id, creator_key, display_name, status, needs_review)
       VALUES ('rv_released', 'rv_released', '已发布的', 'released', true)`,
    )
  })

  afterAll(() => ctx.close())

  it('lists needs_review creators, not reviews rows, with a raw-data flag', async () => {
    const res = await ctx.app.request('/api/ops/review', { headers: auth(ops) })
    expect(res.status).toBe(200)
    const body = await res.json()
    const ids = body.items.map((row: { id: string }) => row.id)
    // Seeded drafts wait too; this file's two come first (newest updated_at).
    expect(ids.slice(0, 2)).toEqual(['rv_sheet', 'rv_ingested'])
    expect(ids).not.toContain('rv_cleared')
    expect(ids).not.toContain('rv_released')
    const ingested = body.items.find((row: { id: string }) => row.id === 'rv_ingested')
    expect(ingested).toMatchObject({
      displayName: '抓取的达人',
      source: 'qiangua',
      followers: 50000,
      verticals: ['护肤'],
      needsReview: true,
      hasRaw: true,
    })
    expect(typeof ingested.createdAt).toBe('string')
    const sheet = body.items.find((row: { id: string }) => row.id === 'rv_sheet')
    expect(sheet).toMatchObject({ hasRaw: false, source: null })
  })

  it('needs ops.read', async () => {
    const res = await ctx.app.request('/api/ops/review', { headers: auth(viewer) })
    expect(res.status).toBe(403)
  })

  it('pass clears the flag and moves the creator to ready — for ingested creators too', async () => {
    const res = await ctx.app.request('/api/ops/review/rv_ingested/pass', { method: 'POST', headers: auth(ops) })
    expect(res.status).toBe(200)
    const row = (await ctx.db.query('SELECT status, needs_review FROM creators WHERE id = $1', ['rv_ingested'])).rows[0]
    expect(row).toEqual({ status: 'ready', needs_review: false })
    const log = await ctx.db.query(
      "SELECT action, entity_type, entity_id FROM audit_logs WHERE action = 'review.pass' ORDER BY created_at DESC LIMIT 1",
    )
    expect(log.rows[0]).toMatchObject({ action: 'review.pass', entity_type: 'creator', entity_id: 'rv_ingested' })
    // Passed creators leave the queue.
    const after = await ctx.app.request('/api/ops/review', { headers: auth(ops) })
    const afterIds = (await after.json()).items.map((row: { id: string }) => row.id)
    expect(afterIds).not.toContain('rv_ingested')
    expect(afterIds[0]).toBe('rv_sheet')
  })

  it('pass closes a pending reviews row left by a sheet delivery', async () => {
    const res = await ctx.app.request('/api/ops/review/rv_sheet/pass', { method: 'POST', headers: auth(ops) })
    expect(res.status).toBe(200)
    const reviews = await ctx.db.query("SELECT status FROM reviews WHERE creator_id = 'rv_sheet'")
    expect(reviews.rows).toEqual([{ status: 'passed' }])
  })

  it('pass refuses to touch a creator outside the queue (released stays released)', async () => {
    const res = await ctx.app.request('/api/ops/review/rv_released/pass', { method: 'POST', headers: auth(ops) })
    expect(res.status).toBe(404)
    const row = (await ctx.db.query('SELECT status FROM creators WHERE id = $1', ['rv_released'])).rows[0]
    expect(row).toEqual({ status: 'released' })
    const missing = await ctx.app.request('/api/ops/review/nope/pass', { method: 'POST', headers: auth(ops) })
    expect(missing.status).toBe(404)
  })

  it('pass needs ops.write', async () => {
    const res = await ctx.app.request('/api/ops/review/rv_cleared/pass', { method: 'POST', headers: auth(viewer) })
    expect(res.status).toBe(403)
  })
})
