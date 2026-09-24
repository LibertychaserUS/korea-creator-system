import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { creatorKeyFor, emptyMetrics, type RawRecord, type SourceAdapter, type SourceQuery } from '@kcs/contract'
import { dataStatusConfig, recordRefreshMisses, runDataStatus } from '../src/ingest/data-status'
import { persistPage } from '../src/ingest/persist'
import { processJob } from '../src/ingest/worker'
import { createTestApp, type TestCtx } from './helpers'

const RUN = `ds${Date.now().toString(36)}`
const present = new Set<string>()
const fans = new Map<string, number>()
let mode: 'live' | 'fixture' = 'live'
let pages = 1

const adapter: SourceAdapter = {
  id: 'qiangua',
  supports: ['externalIds', 'cursor'],
  provides: ['followers'],
  async fetch(query: SourceQuery) {
    const page = query.cursor ? Number(query.cursor) : 1
    const ids = (query.externalIds ?? []).filter((id) => present.has(id))
    const records: RawRecord[] = ids.map((externalId) => ({
      source: 'qiangua',
      platform: 'xhs',
      externalId,
      fetchedAt: new Date().toISOString(),
      payload: { fans: fans.get(externalId) ?? 10_000 },
    }))
    return { records, nextCursor: page < pages ? String(page + 1) : null, sourceMode: mode } as Awaited<ReturnType<SourceAdapter['fetch']>>
  },
  normalize(record) {
    return {
      ok: true,
      creator: {
        creatorKey: creatorKeyFor('qiangua', record.externalId),
        externalId: record.externalId,
        platform: 'xhs',
        displayName: `状态 ${record.externalId}`,
        xhsId: null,
        avatarUrl: null,
        regions: [],
        verticals: [],
        metrics: { ...emptyMetrics(30), followers: Number(record.payload.fans) },
        warnings: [],
      },
    }
  },
}

describe('data status', () => {
  let ctx: TestCtx
  const ops = { authorization: 'Bearer test:ops@kcs.local', 'content-type': 'application/json' }

  beforeAll(async () => {
    ctx = await createTestApp({ getAdapter: (source) => (source === 'qiangua' ? adapter : undefined) })
  })
  beforeEach(() => {
    present.clear()
    fans.clear()
    mode = 'live'
    pages = 1
  })
  afterAll(() => ctx.close())

  const get = async (path: string, headers: Record<string, string> = ops) => {
    const response = await ctx.app.request(path, { headers })
    return { status: response.status, json: await response.json() }
  }
  const post = async (path: string, body: unknown) => {
    const response = await ctx.app.request(path, { method: 'POST', headers: ops, body: JSON.stringify(body) })
    return { status: response.status, json: await response.json() }
  }
  const seed = async (...ids: string[]) => {
    for (const id of ids) {
      present.add(id)
      await persistPage(ctx.env, adapter, await adapter.fetch({ source: 'qiangua', window: 30, externalIds: [id] }), null, 'qiangua')
    }
  }
  const creatorOf = async (externalId: string) => (await ctx.db.query(
    "SELECT creator_id FROM creator_sources WHERE source = 'qiangua' AND external_id = $1",
    [externalId],
  )).rows[0].creator_id as string
  const refresh = async (ids: string[], maxPages = 5) => {
    const { json } = await post('/api/ingest/fetch', { source: 'qiangua', window: 30, externalIds: ids, maxPages })
    return processJob(ctx.env, json.job.id)
  }
  const link = async (externalId: string) => (await ctx.db.query(
    "SELECT miss_count, missing_since, missing_at FROM creator_sources WHERE source = 'qiangua' AND external_id = $1",
    [externalId],
  )).rows[0]

  it('reads its thresholds from env', () => {
    expect(dataStatusConfig({})).toEqual({ staleDays: 30, missingAfter: 3 })
    expect(dataStatusConfig({ DATA_STALE_DAYS: '14', PLATFORM_MISSING_AFTER: '0' })).toEqual({ staleDays: 14, missingAfter: 3 })
  })

  it('three refreshes in a row without the id flag it; nothing is deleted', async () => {
    const [kept, gone] = [`${RUN}-kept`, `${RUN}-gone`]
    await seed(kept, gone)
    present.delete(gone)

    expect(await refresh([kept, gone])).toMatchObject({ status: 'ok' })
    expect(await link(gone)).toMatchObject({ miss_count: 1, missing_at: null })
    expect((await link(gone)).missing_since).not.toBeNull()
    expect(await link(kept)).toMatchObject({ miss_count: 0 })
    await refresh([kept, gone])
    expect((await get(`/api/ingest/data-status/${await creatorOf(gone)}`)).json.platformMissing).toBeNull()
    await refresh([kept, gone])

    expect((await link(gone)).missing_at).not.toBeNull()
    const creatorId = await creatorOf(gone)
    const detail = (await get(`/api/ingest/data-status/${creatorId}`)).json
    expect(detail.platformMissing).toMatchObject({ confirmedAt: null })
    expect(detail.sources).toEqual([expect.objectContaining({ externalId: gone, missCount: 3 })])
    const list = (await get('/api/ingest/data-status?kind=missing')).json
    expect(list.items.map((item: { creatorId: string }) => item.creatorId)).toContain(creatorId)
    expect(list.items.map((item: { creatorId: string }) => item.creatorId)).not.toContain(await creatorOf(kept))
    const audit = await ctx.db.query("SELECT summary FROM audit_logs WHERE action = 'creator.platform_missing' AND entity_id = $1", [creatorId])
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0].summary).toContain('连续 3 次')

    // A fourth miss does not flag or audit twice.
    await refresh([gone])
    expect((await ctx.db.query("SELECT count(*)::int AS n FROM audit_logs WHERE action = 'creator.platform_missing' AND entity_id = $1", [creatorId])).rows[0].n).toBe(1)
    expect((await ctx.db.query('SELECT count(*)::int AS n FROM creators WHERE id = $1', [creatorId])).rows[0].n).toBe(1)
  })

  it('seen again on any fetch → the flag clears by itself', async () => {
    const id = `${RUN}-back`
    await seed(id)
    present.delete(id)
    for (let i = 0; i < 3; i += 1) await refresh([id])
    const creatorId = await creatorOf(id)
    expect((await get(`/api/ingest/data-status/${creatorId}`)).json.platformMissing).not.toBeNull()
    present.add(id)
    await refresh([id])
    expect(await link(id)).toMatchObject({ miss_count: 0, missing_since: null, missing_at: null })
    expect((await get(`/api/ingest/data-status/${creatorId}`)).json.platformMissing).toBeNull()
  })

  it('ops decides: "gone" confirms and stays flagged, "keep" clears; unflagged is 409', async () => {
    const id = `${RUN}-decide`
    await seed(id)
    present.delete(id)
    for (let i = 0; i < 3; i += 1) await refresh([id])
    const creatorId = await creatorOf(id)

    const gone = await post(`/api/ingest/data-status/${creatorId}/missing`, { decision: 'gone' })
    expect(gone.status).toBe(200)
    expect(gone.json.platformMissing.confirmedAt).not.toBeNull()
    const keep = await post(`/api/ingest/data-status/${creatorId}/missing`, { decision: 'keep' })
    expect(keep.status).toBe(200)
    expect(keep.json.platformMissing).toBeNull()
    expect(keep.json.sources[0]).toMatchObject({ missCount: 0, missingAt: null })
    expect((await post(`/api/ingest/data-status/${creatorId}/missing`, { decision: 'keep' })).status).toBe(409)
    expect((await post(`/api/ingest/data-status/${creatorId}/missing`, { decision: 'maybe' })).status).toBe(400)
    expect((await post('/api/ingest/data-status/nobody/missing', { decision: 'keep' })).status).toBe(404)
    const actions = await ctx.db.query('SELECT action FROM audit_logs WHERE entity_id = $1 ORDER BY created_at', [creatorId])
    expect(actions.rows.map((row) => row.action)).toEqual([
      'creator.platform_missing', 'creator.platform_missing_gone', 'creator.platform_missing_keep',
    ])
  })

  it('demo data and runs that stop before the last page never count a miss', async () => {
    const id = `${RUN}-nocount`
    await seed(id)
    present.delete(id)
    mode = 'fixture'
    await refresh([id])
    expect(await link(id)).toMatchObject({ miss_count: 0 })
    mode = 'live'
    pages = 3
    expect(await refresh([id], 1)).toMatchObject({ status: 'ok', pagesDone: 1 })
    expect(await link(id)).toMatchObject({ miss_count: 0 })
    pages = 2
    expect(await refresh([id], 5)).toMatchObject({ status: 'ok', pagesDone: 2 })
    expect(await link(id)).toMatchObject({ miss_count: 1 })
  })

  it('only ids that have a link are counted; an unknown id is ignored', async () => {
    const outcome = await recordRefreshMisses(ctx.env, 'qiangua', [`${RUN}-never-seen`], [], 'job-x')
    expect(outcome).toEqual({ missed: 0, flagged: [] })
  })

  it('stale: no fetch for more than 30 days', async () => {
    const id = `${RUN}-old`
    await seed(id)
    const creatorId = await creatorOf(id)
    await ctx.db.query("UPDATE creators SET metrics_fetched_at = now() - interval '31 days' WHERE id = $1", [creatorId])
    const detail = (await get(`/api/ingest/data-status/${creatorId}`)).json
    expect(detail).toMatchObject({ stale: true, daysSinceFetch: 31 })
    const list = (await get('/api/ingest/data-status?kind=stale&pageSize=200')).json
    expect(list.items.map((item: { creatorId: string }) => item.creatorId)).toContain(creatorId)
    expect(list.config).toEqual({ staleDays: 30, missingAfter: 3 })
    const counts = (await get('/api/ingest/data-status')).json
    expect(counts.counts.stale).toBeGreaterThanOrEqual(1)
    expect((await get('/api/ingest/data-status?kind=weird')).status).toBe(400)
  })

  it('republishable: newer numbers past tolerance than the published snapshot, until it is re-published', async () => {
    const id = `${RUN}-pub`
    fans.set(id, 10_000)
    await seed(id)
    const creatorId = await creatorOf(id)
    await ctx.db.query(
      "UPDATE creators SET status = 'released', metrics_locked = metrics, metrics_locked_at = now() - interval '1 day' WHERE id = $1",
      [creatorId],
    )
    fans.set(id, 10_100) // within 2%
    await refresh([id])
    expect((await get(`/api/ingest/data-status/${creatorId}`)).json).toMatchObject({ republishable: false, changedSincePublish: [] })

    fans.set(id, 13_000)
    await refresh([id])
    const detail = (await get(`/api/ingest/data-status/${creatorId}`)).json
    expect(detail).toMatchObject({ republishable: true, changedSincePublish: ['followers'] })
    const list = (await get('/api/ingest/data-status?kind=republish')).json
    expect(list.items.map((item: { creatorId: string }) => item.creatorId)).toContain(creatorId)

    // Re-published: the snapshot is the latest now; the list drops it even before the daily re-check.
    await ctx.db.query('UPDATE creators SET metrics_locked = metrics, metrics_locked_at = now() WHERE id = $1', [creatorId])
    expect((await get('/api/ingest/data-status?kind=republish')).json.items.map((item: { creatorId: string }) => item.creatorId))
      .not.toContain(creatorId)
    expect((await get(`/api/ingest/data-status/${creatorId}`)).json.republishable).toBe(false)
    const daily = await runDataStatus(ctx.env)
    expect(daily.checked).toBeGreaterThanOrEqual(1)
    const row = (await ctx.db.query('SELECT republish_changes FROM creators WHERE id = $1', [creatorId])).rows[0]
    expect(row.republish_changes).toEqual([])
  })

  it('needs ingest rights', async () => {
    expect((await get('/api/ingest/data-status', { authorization: 'Bearer test:selector@kcs.local' })).status).toBe(403)
    const response = await ctx.app.request('/api/ingest/data-status/x/missing', {
      method: 'POST',
      headers: { authorization: 'Bearer test:devops@kcs.local', 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'keep' }),
    })
    expect([403, 404]).toContain(response.status)
  })
})
