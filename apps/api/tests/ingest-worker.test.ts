import { afterEach, describe, expect, it } from 'vitest'
import {
  creatorKeyFor,
  emptyMetrics,
  type RawRecord,
  type SourceAdapter,
  type SourceQuery,
} from '@kcs/contract'
import { processJob, TokenBucket } from '../src/ingest/worker'
import { createTestApp, type TestCtx } from './helpers'

const contexts: TestCtx[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

function pagedAdapter(): SourceAdapter {
  return {
    id: 'qiangua',
    supports: ['cursor'],
    provides: ['followers'],
    async fetch(query: SourceQuery) {
      const page = query.cursor ? Number(query.cursor) : 1
      const raw: RawRecord = {
        source: 'qiangua',
        platform: 'xhs',
        externalId: `queue-${page}`,
        fetchedAt: `2026-09-${String(page).padStart(2, '0')}T00:00:00.000Z`,
        payload: { page },
      }
      return {
        records: [raw],
        nextCursor: page === 1 ? '2' : null,
      }
    },
    normalize(raw) {
      const page = Number(raw.payload.page)
      return {
        ok: true,
        creator: {
          creatorKey: creatorKeyFor('xhs', raw.externalId),
          externalId: raw.externalId,
          platform: 'xhs',
          displayName: `队列达人${page}`,
          xhsId: null,
          avatarUrl: null,
          regions: [],
          verticals: [],
          metrics: { ...emptyMetrics(30), followers: page * 10_000 },
          warnings: [],
        },
      }
    },
  }
}

async function setup() {
  const adapter = pagedAdapter()
  const context = await createTestApp({
    getAdapter: (source) => source === adapter.id ? adapter : undefined,
  })
  contexts.push(context)
  const token = (await context.loginJson('ops@kcs.local')).token
  const devToken = (await context.loginJson('devops@kcs.local')).token
  return { context, token, devToken }
}

async function enqueue(context: TestCtx, token: string) {
  return context.app.request('/api/ingest/fetch', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ source: 'qiangua', window: 30, maxPages: 5 }),
  })
}

describe('ingest worker', () => {
  it('queues with 202 and processes all pages to ok', async () => {
    const { context, token } = await setup()
    const response = await enqueue(context, token)
    expect(response.status).toBe(202)
    const { job } = await response.json()
    expect(job).toMatchObject({
      status: 'queued',
      pagesDone: 0,
      cursor: null,
      quotaUsed: 0,
      attempts: 0,
    })

    const completed = await processJob(context.env, job.id)
    expect(completed).toMatchObject({
      status: 'ok',
      pagesDone: 2,
      cursor: null,
      quotaUsed: 2,
      writtenCount: 2,
    })
  })

  it('keeps the cursor on quota partial and retry resumes it', async () => {
    const { context, token, devToken } = await setup()
    await context.db.query("UPDATE ingest_sources SET quota = 1 WHERE id = 'qiangua'")
    const response = await enqueue(context, token)
    const { job } = await response.json()
    const partial = await processJob(context.env, job.id)
    expect(partial).toMatchObject({
      status: 'partial',
      pagesDone: 1,
      cursor: '2',
      quotaUsed: 1,
      error: 'quota_exhausted',
    })

    await context.db.query("UPDATE ingest_sources SET quota = 2 WHERE id = 'qiangua'")
    const retried = await context.app.request(`/api/ingest/jobs/${job.id}/retry`, {
      method: 'POST',
      headers: { authorization: `Bearer ${devToken}` },
    })
    expect(retried.status).toBe(200)
    expect(await processJob(context.env, job.id)).toMatchObject({
      status: 'ok',
      pagesDone: 2,
      cursor: null,
      quotaUsed: 2,
    })
  })

  it('resumes a partial job on its own once next_run_at has passed (no manual retry)', async () => {
    const { context, token } = await setup()
    await context.db.query("UPDATE ingest_sources SET quota = 1 WHERE id = 'qiangua'")
    const { job } = await (await enqueue(context, token)).json()
    expect(await processJob(context.env, job.id)).toMatchObject({ status: 'partial', cursor: '2' })

    // The day rolls over: quota is back and the scheduled resume time is due.
    await context.db.query("UPDATE ingest_sources SET quota = 5 WHERE id = 'qiangua'")
    await context.db.query("UPDATE ingest_jobs SET next_run_at = now() WHERE id = $1", [job.id])
    const due = await context.db.query(
      `SELECT id FROM ingest_jobs
       WHERE (status = 'queued' OR (status = 'partial' AND next_run_at IS NOT NULL))
         AND (next_run_at IS NULL OR next_run_at <= now())`,
    )
    expect(due.rows.map((row) => row.id)).toContain(job.id)
    expect(await processJob(context.env, job.id)).toMatchObject({
      status: 'ok',
      pagesDone: 2,
      cursor: null,
      quotaUsed: 2,
      attempts: 0,
    })
  })

  it('counts the quota by the vendor day: Beijing midnight (16:00 UTC) resets it', async () => {
    const { context, token } = await setup()
    await context.db.query("UPDATE ingest_sources SET quota = 1 WHERE id = 'qiangua'")
    let clock = new Date('2026-09-24T15:59:00.000Z') // 23:59 in Beijing, same UTC day as below
    context.env.now = () => clock
    const { job } = await (await enqueue(context, token)).json()
    const partial = await processJob(context.env, job.id)
    expect(partial).toMatchObject({ status: 'partial', cursor: '2', quotaUsed: 1 })
    expect(new Date(partial!.nextRunAt!).toISOString()).toBe('2026-09-24T16:00:00.000Z')

    clock = new Date('2026-09-24T16:01:00.000Z') // 00:01 the next Beijing day
    await context.db.query('UPDATE ingest_jobs SET next_run_at = now() WHERE id = $1', [job.id])
    expect(await processJob(context.env, job.id)).toMatchObject({ status: 'ok', pagesDone: 2, quotaUsed: 2 })
    const usage = await context.db.query(
      "SELECT day::text AS day, calls FROM ingest_source_usage WHERE source = 'qiangua' ORDER BY day",
    )
    expect(usage.rows).toEqual([{ day: '2026-09-24', calls: 1 }, { day: '2026-09-25', calls: 1 }])
  })

  it('a source can keep its quota in another zone; an unknown zone falls back to Beijing', async () => {
    const { context, token } = await setup()
    await context.db.query("UPDATE ingest_sources SET quota = 1, quota_tz = 'Asia/Seoul' WHERE id = 'qiangua'")
    context.env.now = () => new Date('2026-09-24T15:30:00.000Z') // already the 25th in Seoul
    const { job } = await (await enqueue(context, token)).json()
    const partial = await processJob(context.env, job.id)
    expect(new Date(partial!.nextRunAt!).toISOString()).toBe('2026-09-25T15:00:00.000Z')

    await context.db.query("UPDATE ingest_sources SET quota_tz = 'Mars/Olympus' WHERE id = 'qiangua'")
    await context.db.query("UPDATE ingest_jobs SET status = 'queued', next_run_at = now() WHERE id = $1", [job.id])
    // Beijing is still on the 24th, whose call has not been spent yet.
    expect(await processJob(context.env, job.id)).toMatchObject({ status: 'ok', pagesDone: 2 })
    const usage = await context.db.query(
      "SELECT day::text AS day, calls FROM ingest_source_usage WHERE source = 'qiangua' ORDER BY day",
    )
    expect(usage.rows).toEqual([{ day: '2026-09-24', calls: 1 }, { day: '2026-09-25', calls: 1 }])
  })

  it('does not charge quota for demo-data pages', async () => {
    const adapter = pagedAdapter()
    const fixtureAdapter: SourceAdapter = {
      ...adapter,
      async fetch(query) {
        return { ...(await adapter.fetch(query)), sourceMode: 'fixture' } as Awaited<ReturnType<SourceAdapter['fetch']>>
      },
    }
    const context = await createTestApp({ getAdapter: (source) => source === 'qiangua' ? fixtureAdapter : undefined })
    contexts.push(context)
    const token = (await context.loginJson('ops@kcs.local')).token
    const { job } = await (await enqueue(context, token)).json()
    expect(await processJob(context.env, job.id)).toMatchObject({
      status: 'ok',
      pagesDone: 2,
      quotaUsed: 0,
      sourceMode: 'fixture',
    })
    const usage = await context.db.query("SELECT calls FROM ingest_source_usage WHERE source = 'qiangua'")
    expect(Number(usage.rows[0]?.calls ?? 0)).toBe(0)
  })

  it('refills a token bucket at the configured rate', () => {
    const bucket = new TokenBucket(2, 0)
    expect(bucket.tryTake(0)).toBe(true)
    expect(bucket.tryTake(0)).toBe(true)
    expect(bucket.tryTake(0)).toBe(false)
    expect(bucket.waitMs(0)).toBe(30_000)
    expect(bucket.tryTake(30_000)).toBe(true)
  })

  it('cancels a queued job before a worker can claim it', async () => {
    const { context, token } = await setup()
    const response = await enqueue(context, token)
    const { job } = await response.json()
    const cancelled = await context.app.request(`/api/ingest/jobs/${job.id}/cancel`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(cancelled.status).toBe(200)
    expect(await cancelled.json()).toMatchObject({
      status: 'failed',
      error: 'cancelled',
    })
    expect(await processJob(context.env, job.id)).toMatchObject({
      status: 'failed',
      pagesDone: 0,
    })
  })
})
