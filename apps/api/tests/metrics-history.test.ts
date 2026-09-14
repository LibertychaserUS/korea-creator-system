import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  creatorKeyFor,
  emptyMetrics,
  type SourceAdapter,
} from '@kcs/contract'
import { processJob } from '../src/ingest/worker'
import { createTestApp, type TestCtx } from './helpers'

describe('creator metric history', () => {
  let context: TestCtx
  let calls = 0
  const adapter: SourceAdapter = {
    id: 'qiangua',
    supports: [],
    provides: ['followers'],
    async fetch() {
      calls += 1
      return {
        nextCursor: null,
        records: [{
          source: 'qiangua',
          platform: 'xhs',
          externalId: 'history-same',
          fetchedAt: `2026-08-0${calls}T08:00:00.000Z`,
          payload: { followers: calls * 100 },
        }],
      }
    },
    normalize(raw) {
      return {
        ok: true,
        creator: {
          creatorKey: creatorKeyFor('xhs', raw.externalId),
          externalId: raw.externalId,
          platform: 'xhs',
          displayName: '历史达人',
          xhsId: 'history-xhs',
          avatarUrl: null,
          regions: ['서울'],
          verticals: ['beauty'],
          metrics: {
            ...emptyMetrics(30),
            followers: Number(raw.payload.followers),
            readMedian: Number(raw.payload.followers) / 2,
          },
          warnings: [],
        },
      }
    },
  }

  beforeAll(async () => {
    context = await createTestApp({
      getAdapter: (source) => source === 'qiangua' ? adapter : undefined,
    })
  })

  afterAll(() => context.close())

  it('keeps both ingests and exposes the latest metrics on the creator', async () => {
    const ops = await context.loginJson('ops@kcs.local')
    let creatorId = ''
    for (let index = 0; index < 2; index += 1) {
      const queued = await context.app.request('/api/ingest/fetch', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${ops.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ source: 'qiangua', window: 30 }),
      })
      const { job } = await queued.json()
      await processJob(context.env, job.id)
      const sample = await context.app.request(`/api/ingest/jobs/${job.id}/sample`, {
        headers: { authorization: `Bearer ${ops.token}` },
      })
      creatorId = (await sample.json()).items[0].id
    }

    await context.app.request(`/api/ops/creators/${creatorId}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${ops.token}` },
    })
    const selector = await context.loginJson('selector@kcs.local')
    const history = await context.app.request(`/api/select/creators/${creatorId}/history`, {
      headers: { authorization: `Bearer ${selector.token}` },
    })
    expect(history.status).toBe(200)
    const snapshots = (await history.json()).snapshots
    expect(snapshots).toHaveLength(2)
    expect(snapshots.map((snapshot: { metrics: { followers: number } }) =>
      snapshot.metrics.followers)).toEqual([100, 200])

    const detail = await context.app.request(`/api/select/creators/${creatorId}`, {
      headers: { authorization: `Bearer ${selector.token}` },
    })
    expect((await detail.json()).metrics.followers).toBe(200)
  })
})
