import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('adapter ingest fetch', () => {
  let ctx: TestCtx
  let token: string

  beforeAll(async () => {
    delete process.env.QIANGUA_TOKEN
    ctx = await createTestApp()
    token = (await ctx.loginJson('ops@kcs.local')).token
  })
  afterAll(() => ctx.close())

  async function fetchOne() {
    const res = await ctx.app.request('/api/ingest/fetch?sync=1', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'qiangua', window: 30, externalIds: ['qg_001'], limit: 1 }),
    })
    expect(res.status).toBe(201)
    return res.json()
  }

  it('uses fixture mode, stores raw JSON, and upserts idempotently', async () => {
    const first = await fetchOne()
    expect(first).toMatchObject({ sourceId: 'qiangua', sourceMode: 'fixture', writtenCount: 0, skippedDupes: 1 })
    expect(first.failedCount).toBe(0)

    const second = await fetchOne()
    expect(second.sourceMode).toBe('fixture')
    expect(second.writtenCount).toBe(0)
    expect(second.skippedDupes).toBe(1)

    const sample = await ctx.app.request(`/api/ingest/jobs/${second.id}/sample`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const creatorId = (await sample.json()).items[0].id
    const raw = await ctx.app.request(`/api/ingest/raw/${creatorId}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(raw.status).toBe(200)
    expect(await raw.json()).toMatchObject({
      creatorId,
      source: 'qiangua',
      externalId: 'qg_001',
      payload: { 达人ID: 'qg_001', 千瓜指数: 918 },
    })
  })
})
