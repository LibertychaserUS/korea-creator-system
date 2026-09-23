import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creatorKeyFor, emptyMetrics, type SourceAdapter } from '@kcs/contract'
import { processJob, replayRecord } from '../src/ingest/worker'
import { createTestApp, type TestCtx } from './helpers'

/**
 * Publish freezes what the select pool filters, sorts and ranks on. Ingest,
 * replays and edits only move the latest numbers; a take-down plus a fresh
 * publish is the one way the pool picks them up.
 */
describe('published snapshot', () => {
  let ctx: TestCtx
  let followers = 10_000
  const adapter: SourceAdapter = {
    id: 'qiangua',
    supports: [],
    provides: ['followers'],
    async fetch() {
      return {
        nextCursor: null,
        records: [{
          source: 'qiangua',
          platform: 'xhs',
          externalId: 'snapshot-one',
          fetchedAt: new Date().toISOString(),
          payload: { followers },
        }],
      }
    },
    normalize(raw) {
      const count = Number(raw.payload.followers)
      return {
        ok: true,
        creator: {
          creatorKey: creatorKeyFor('xhs', raw.externalId),
          externalId: raw.externalId,
          platform: 'xhs',
          displayName: '快照达人',
          xhsId: 'snapshot-xhs',
          avatarUrl: null,
          regions: ['서울'],
          verticals: ['beauty'],
          metrics: { ...emptyMetrics(30), followers: count, readMedian: count / 10 },
          warnings: [],
        },
      }
    },
  }

  let opsToken = ''
  let selectorToken = ''
  let creatorId = ''

  const get = async (path: string, token: string) => {
    const res = await ctx.app.request(path, { headers: { authorization: `Bearer ${token}` } })
    return { status: res.status, body: await res.json() }
  }
  const post = async (path: string, token: string, body?: unknown) => {
    const res = await ctx.app.request(path, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status, body: await res.json() }
  }
  const ingest = async (count: number) => {
    followers = count
    const queued = await post('/api/ingest/fetch', opsToken, { source: 'qiangua', window: 30 })
    await processJob(ctx.env, queued.body.job.id)
    const sample = await get(`/api/ingest/jobs/${queued.body.job.id}/sample`, opsToken)
    return String(sample.body.items[0].id)
  }
  const poolRow = async (query = '') => {
    const pool = await get(`/api/select/pool${query}`, selectorToken)
    return pool.body.items.find((row: { id: string }) => row.id === creatorId)
  }

  beforeAll(async () => {
    ctx = await createTestApp({ getAdapter: (source) => (source === 'qiangua' ? adapter : undefined) })
    opsToken = (await ctx.loginJson('ops@kcs.local')).token
    selectorToken = (await ctx.loginJson('selector@kcs.local')).token
  })

  afterAll(() => ctx.close())

  it('a fresh ingest waits for review and stays out of the pool', async () => {
    creatorId = await ingest(10_000)
    const detail = await get(`/api/ops/creators/${creatorId}`, opsToken)
    expect(detail.body.stage).toBe('review')
    expect(detail.body.metricsLocked).toBeNull()
    expect(detail.body.metricsLockedAt).toBeNull()
    expect(await poolRow()).toBeUndefined()
  })

  it('publish copies the current numbers into the snapshot', async () => {
    const published = await post(`/api/ops/creators/${creatorId}/publish`, opsToken)
    expect(published.status).toBe(200)
    expect(published.body.refreshed).toBe(true)
    expect(published.body.metricsLockedAt).toBeTruthy()
    const row = await poolRow()
    expect(row.followers).toBe(10_000)
    expect(row.metrics.followers).toBe(10_000)
    expect(row.metricsLockedAt).toBe(published.body.metricsLockedAt)
    const detail = await get(`/api/ops/creators/${creatorId}`, opsToken)
    expect(detail.body.stage).toBe('released')
    expect(detail.body.needsReview).toBe(false)
  })

  it('a later ingest moves the latest numbers but not the pool', async () => {
    expect(await ingest(40_000)).toBe(creatorId)
    const row = await poolRow()
    expect(row.followers).toBe(10_000)
    expect(row.tier).toBe('junior')

    const select = await get(`/api/select/creators/${creatorId}`, selectorToken)
    expect(select.body.metrics.followers).toBe(10_000)
    expect(select.body.metricsLatest.followers).toBe(40_000)

    const ops = await get(`/api/ops/creators/${creatorId}`, opsToken)
    expect(ops.body.metrics.followers).toBe(40_000)
    expect(ops.body.metricsLocked.followers).toBe(10_000)

    const history = await get(`/api/select/creators/${creatorId}/history`, selectorToken)
    expect(history.body.snapshots.length).toBeGreaterThanOrEqual(1)
  })

  it('pool filters and sorts on the snapshot, not the latest ingest', async () => {
    expect(await poolRow('?followersMin=20000')).toBeUndefined()
    expect(await poolRow('?followersMax=15000')).toBeTruthy()
  })

  it('replaying a parked record and editing followers leave the snapshot alone', async () => {
    await replayRecord(ctx.env, {
      source: 'qiangua',
      jobId: null,
      externalId: 'snapshot-one',
      payload: { followers: 55_000 },
    })
    const patch = await ctx.app.request(`/api/ops/creators/${creatorId}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${opsToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ followers: 60_000 }),
    })
    expect(patch.status).toBe(200)
    expect((await poolRow()).followers).toBe(10_000)
    const ops = await get(`/api/ops/creators/${creatorId}`, opsToken)
    expect(ops.body.metrics.followers).toBe(60_000)
    expect(ops.body.metricsLocked.followers).toBe(10_000)
  })

  it('publishing again while released keeps the old snapshot', async () => {
    const again = await post(`/api/ops/creators/${creatorId}/publish`, opsToken)
    expect(again.status).toBe(200)
    expect(again.body.refreshed).toBe(false)
    expect((await poolRow()).followers).toBe(10_000)
  })

  it('take-down then re-publish moves the pool onto the latest numbers', async () => {
    const before = (await poolRow()).metricsLockedAt
    const down = await post(`/api/ops/creators/${creatorId}/unpublish`, opsToken)
    expect(down.status).toBe(200)
    expect(await poolRow()).toBeUndefined()
    const withdrawn = await get(`/api/ops/creators/${creatorId}`, opsToken)
    expect(withdrawn.body.stage).toBe('withdrawn')
    expect(withdrawn.body.metricsLocked.followers).toBe(10_000)
    const overview = await get('/api/ops/overview', opsToken)
    expect(overview.body.counts.withdrawn).toBeGreaterThanOrEqual(1)

    await new Promise((resolve) => setTimeout(resolve, 5))
    const back = await post(`/api/ops/creators/${creatorId}/publish`, opsToken)
    expect(back.body.refreshed).toBe(true)
    const row = await poolRow()
    expect(row.followers).toBe(60_000)
    expect(row.tier).toBe('mid')
    expect(new Date(row.metricsLockedAt).getTime()).toBeGreaterThan(new Date(before).getTime())
  })

  it('overview counts creators waiting for review', async () => {
    const overview = await get('/api/ops/overview', opsToken)
    expect(overview.body.counts.pending).toBeGreaterThan(0)
    const list = await get('/api/ops/creators', opsToken)
    const stages = new Set(list.body.items.map((item: { stage: string }) => item.stage))
    expect(stages.has('review')).toBe(true)
    expect(stages.has('released')).toBe(true)
  })
})
