import { afterEach, describe, expect, it } from 'vitest'
import {
  classifyIngestFailure,
  creatorKeyFor,
  emptyMetrics,
  type RawRecord,
  type SourceAdapter,
  type SourceQuery,
} from '@kcs/contract'
import { processJob, startIngestWorker } from '../src/ingest/worker'
import { createTestApp, type TestCtx } from './helpers'

const contexts: TestCtx[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

function raw(externalId: string, payload: Record<string, unknown> = {}): RawRecord {
  return {
    source: 'qiangua',
    platform: 'xhs',
    externalId,
    fetchedAt: '2026-09-14T00:00:00.000Z',
    payload,
  }
}

/** One page, one record; `normalize` accepts it only when the payload has a name. */
function pickyAdapter(options: { fail?: Error } = {}): SourceAdapter {
  return {
    id: 'qiangua',
    supports: [],
    provides: ['followers'],
    async fetch(_query: SourceQuery) {
      if (options.fail) throw options.fail
      return { records: [raw('dl-1', { 昵称: '' }), raw('dl-2', { 昵称: '能读的' })], nextCursor: null }
    },
    normalize(record) {
      const name = record.payload?.['昵称']
      if (!name) return { ok: false, errors: ['missing 昵称'] }
      return {
        ok: true,
        creator: {
          creatorKey: creatorKeyFor('xhs', record.externalId),
          externalId: record.externalId,
          platform: 'xhs',
          displayName: String(name),
          xhsId: null,
          avatarUrl: null,
          regions: [],
          verticals: [],
          metrics: { ...emptyMetrics(30), followers: 10_000 },
          warnings: [],
        },
      }
    },
  }
}

async function setup(adapter: SourceAdapter) {
  const context = await createTestApp({
    getAdapter: (source) => (source === adapter.id ? adapter : undefined),
  })
  contexts.push(context)
  const ops = (await context.loginJson('ops@kcs.local')).token
  const devops = (await context.loginJson('devops@kcs.local')).token
  return { context, ops, devops }
}

function enqueue(context: TestCtx, token: string, body: Record<string, unknown> = {}) {
  return context.app.request('/api/ingest/fetch', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ source: 'qiangua', window: 30, maxPages: 1, ...body }),
  })
}

function get(context: TestCtx, token: string, path: string) {
  return context.app.request(path, { headers: { authorization: `Bearer ${token}` } })
}

function post(context: TestCtx, token: string, path: string) {
  return context.app.request(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('failure classification', () => {
  it('separates "come back later" from "nothing will change until a human acts"', () => {
    expect(classifyIngestFailure('qiangua HTTP 500')).toEqual({
      code: 'SOURCE_UNAVAILABLE',
      permanent: false,
    })
    expect(classifyIngestFailure('qiangua HTTP 429')).toEqual({
      code: 'SOURCE_UNAVAILABLE',
      permanent: false,
    })
    expect(classifyIngestFailure('qiangua HTTP 401')).toEqual({
      code: 'VENDOR_REJECTED',
      permanent: true,
    })
    expect(classifyIngestFailure('unsupported adapter: weibo')).toEqual({
      code: 'CONFIG_MISSING',
      permanent: true,
    })
  })
})

describe('dead letters — records', () => {
  it('parks an unreadable payload instead of only counting it', async () => {
    const { context, ops, devops } = await setup(pickyAdapter())
    const { job } = await (await enqueue(context, ops)).json()
    const done = await processJob(context.env, job.id)
    expect(done).toMatchObject({ status: 'ok', writtenCount: 1, failedCount: 1 })

    const list = await (await get(context, devops, '/api/dev/dead-letters')).json()
    expect(list.items).toHaveLength(1)
    expect(list.items[0]).toMatchObject({
      kind: 'record',
      state: 'open',
      source: 'qiangua',
      externalId: 'dl-1',
      code: 'RECORD_INVALID',
      jobId: job.id,
      replayCount: 0,
    })
    // The payload is kept verbatim so a replay needs no vendor call.
    expect(list.items[0].payload).toEqual({ 昵称: '' })
    expect(list.items[0].message).toContain('missing 昵称')
  })

  it('a payload that fails twice updates its entry instead of piling up copies', async () => {
    const { context, ops, devops } = await setup(pickyAdapter())
    for (let i = 0; i < 2; i += 1) {
      const { job } = await (await enqueue(context, ops)).json()
      await processJob(context.env, job.id)
    }
    const list = await (await get(context, devops, '/api/dev/dead-letters')).json()
    expect(list.items).toHaveLength(1)
    expect(list.items[0].attempts).toBe(2)
  })

  it('replaying a fixed payload writes the creator and closes the entry, without touching quota', async () => {
    const { context, ops, devops } = await setup(pickyAdapter())
    const { job } = await (await enqueue(context, ops)).json()
    await processJob(context.env, job.id)
    const [entry] = (await (await get(context, devops, '/api/dev/dead-letters')).json()).items

    // Someone fixes the payload (in the real world: the field map).
    await context.db.query(
      `UPDATE ingest_dead_letters SET payload = '{"昵称":"修好了"}'::jsonb WHERE id = $1`,
      [entry.id],
    )
    const usageBefore = await context.db.query(
      "SELECT coalesce(sum(calls),0)::int AS n FROM ingest_source_usage WHERE source = 'qiangua'",
    )

    const replay = await post(context, devops, `/api/dev/dead-letters/${entry.id}/replay`)
    expect(replay.status).toBe(200)
    const body = await replay.json()
    expect(body.result).toMatchObject({ written: 1, failed: 0 })
    expect(body.deadLetter).toMatchObject({ state: 'replayed', replayCount: 1 })
    expect(body.deadLetter.resolvedBy).toBe('user_devops')

    const usageAfter = await context.db.query(
      "SELECT coalesce(sum(calls),0)::int AS n FROM ingest_source_usage WHERE source = 'qiangua'",
    )
    expect(usageAfter.rows[0].n).toBe(usageBefore.rows[0].n)

    const open = await (await get(context, devops, '/api/dev/dead-letters')).json()
    expect(open.items).toHaveLength(0)
    const all = await (await get(context, devops, '/api/dev/dead-letters?state=all')).json()
    expect(all.items).toHaveLength(1)
  })

  it('a replay that still fails stays parked and counts, and stops being offered after three', async () => {
    const { context, ops, devops } = await setup(pickyAdapter())
    const { job } = await (await enqueue(context, ops)).json()
    await processJob(context.env, job.id)
    const [entry] = (await (await get(context, devops, '/api/dev/dead-letters')).json()).items

    for (let i = 1; i <= 3; i += 1) {
      const res = await post(context, devops, `/api/dev/dead-letters/${entry.id}/replay`)
      expect(res.status).toBe(409)
      expect((await res.json()).deadLetter).toMatchObject({ state: 'open', replayCount: i })
    }
    const exhausted = await post(context, devops, `/api/dev/dead-letters/${entry.id}/replay`)
    expect(exhausted.status).toBe(409)
    expect((await exhausted.json()).error.message).toBe('dead_letter_replays_exhausted')
  })

  it('dismiss takes it off the list for good; a second dismiss is 409', async () => {
    const { context, ops, devops } = await setup(pickyAdapter())
    const { job } = await (await enqueue(context, ops)).json()
    await processJob(context.env, job.id)
    const [entry] = (await (await get(context, devops, '/api/dev/dead-letters')).json()).items

    const first = await post(context, devops, `/api/dev/dead-letters/${entry.id}/dismiss`)
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ state: 'dismissed', resolvedBy: 'user_devops' })
    const second = await post(context, devops, `/api/dev/dead-letters/${entry.id}/dismiss`)
    expect(second.status).toBe(409)
    const replay = await post(context, devops, `/api/dev/dead-letters/${entry.id}/replay`)
    expect(replay.status).toBe(409)
  })

  it('ops may look but not act; unknown ids are 404', async () => {
    const { context, ops, devops } = await setup(pickyAdapter())
    const { job } = await (await enqueue(context, ops)).json()
    await processJob(context.env, job.id)
    const [entry] = (await (await get(context, devops, '/api/dev/dead-letters')).json()).items

    expect((await get(context, ops, '/api/dev/dead-letters')).status).toBe(200)
    expect((await post(context, ops, `/api/dev/dead-letters/${entry.id}/replay`)).status).toBe(403)
    expect((await post(context, ops, `/api/dev/dead-letters/${entry.id}/dismiss`)).status).toBe(403)

    const selector = (await context.loginJson('selector@kcs.local')).token
    expect((await get(context, selector, '/api/dev/dead-letters')).status).toBe(403)
    expect((await get(context, devops, '/api/dev/dead-letters/nope')).status).toBe(404)
    expect((await post(context, devops, '/api/dev/dead-letters/nope/replay')).status).toBe(404)
  })
})

describe('dead letters — whole runs', () => {
  it('a permanent failure parks on the first attempt: no backoff, no wasted calls', async () => {
    const { context, ops, devops } = await setup(
      pickyAdapter({ fail: new Error('qiangua HTTP 401 unauthorized') }),
    )
    const { job } = await (await enqueue(context, ops, { keyword: 'permanent' })).json()
    const failed = await processJob(context.env, job.id)
    expect(failed).toMatchObject({
      status: 'failed',
      attempts: 1,
      errorCode: 'VENDOR_REJECTED',
      nextRunAt: null,
    })

    const list = await (await get(context, devops, '/api/dev/dead-letters?kind=job')).json()
    expect(list.items).toHaveLength(1)
    expect(list.items[0]).toMatchObject({
      kind: 'job',
      state: 'open',
      jobId: job.id,
      code: 'VENDOR_REJECTED',
      attempts: 1,
    })
    // The parameters travel with it, so a replay continues instead of guessing.
    expect(list.items[0].query).toMatchObject({ source: 'qiangua', keyword: 'permanent' })
  })

  it('a transient failure spends its attempts first, then parks', async () => {
    const { context, ops, devops } = await setup(
      pickyAdapter({ fail: new Error('qiangua HTTP 503') }),
    )
    const { job } = await (await enqueue(context, ops)).json()
    for (let i = 1; i <= 2; i += 1) {
      const mid = await processJob(context.env, job.id)
      expect(mid).toMatchObject({ status: 'queued', attempts: i })
      expect(mid!.nextRunAt).not.toBeNull()
      await context.db.query('UPDATE ingest_jobs SET next_run_at = now() WHERE id = $1', [job.id])
    }
    expect((await (await get(context, devops, '/api/dev/dead-letters?kind=job')).json()).items).toHaveLength(0)

    const dead = await processJob(context.env, job.id)
    expect(dead).toMatchObject({ status: 'failed', attempts: 3, errorCode: 'SOURCE_UNAVAILABLE' })
    const list = await (await get(context, devops, '/api/dev/dead-letters?kind=job')).json()
    expect(list.items).toHaveLength(1)
    expect(list.items[0].attempts).toBe(3)
  })

  it('replaying a parked run queues a new one from the saved cursor and settles the entry', async () => {
    const { context, ops, devops } = await setup(
      pickyAdapter({ fail: new Error('qiangua HTTP 401') }),
    )
    const { job } = await (await enqueue(context, ops)).json()
    await processJob(context.env, job.id)
    await context.db.query("UPDATE ingest_dead_letters SET cursor = '7' WHERE job_id = $1", [job.id])
    const [entry] = (await (await get(context, devops, '/api/dev/dead-letters?kind=job')).json()).items

    const replay = await post(context, devops, `/api/dev/dead-letters/${entry.id}/replay`)
    expect(replay.status).toBe(200)
    const body = await replay.json()
    expect(body.job).toMatchObject({ status: 'queued', sourceId: 'qiangua', cursor: '7' })
    expect(body.job.id).not.toBe(job.id)
    expect(body.deadLetter).toMatchObject({ state: 'replayed', replayJobId: body.job.id })

    const audit = await (await get(context, devops, '/api/dev/audit')).json()
    expect(audit.items.some((row: any) => row.action === 'ingest.deadLetter.replay')).toBe(true)
  })

  it('requeueing the job by hand settles its entry too — no stale parked run', async () => {
    const { context, ops, devops } = await setup(
      pickyAdapter({ fail: new Error('qiangua HTTP 401') }),
    )
    const { job } = await (await enqueue(context, ops)).json()
    await processJob(context.env, job.id)
    expect((await (await get(context, devops, '/api/dev/dead-letters?kind=job')).json()).items).toHaveLength(1)

    const retry = await post(context, devops, `/api/dev/jobs/${job.id}/retry`)
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ status: 'queued', attempts: 0 })
    expect((await (await get(context, devops, '/api/dev/dead-letters?kind=job')).json()).items).toHaveLength(0)
    const all = await (await get(context, devops, '/api/dev/dead-letters?state=all')).json()
    expect(all.items[0]).toMatchObject({ state: 'replayed', replayJobId: job.id })
  })

  it('credentials never reach the parked message', async () => {
    const { context, ops, devops } = await setup(
      pickyAdapter({
        fail: new Error('qiangua HTTP 401 GET https://api.qian-gua.com/x?token=super-secret'),
      }),
    )
    const { job } = await (await enqueue(context, ops)).json()
    await processJob(context.env, job.id)
    const [entry] = (await (await get(context, devops, '/api/dev/dead-letters?kind=job')).json()).items
    expect(entry.message).not.toContain('super-secret')
    expect(entry.message).toContain('token=***')
  })

  it('the health page counts what is parked and who is draining', async () => {
    const { context, ops, devops } = await setup(pickyAdapter())
    const { job } = await (await enqueue(context, ops)).json()
    await processJob(context.env, job.id)
    const health = await (await get(context, devops, '/api/dev/health')).json()
    expect(health.deadLetters).toMatchObject({ records: 1, jobs: 0, total: 1 })
    expect(Array.isArray(health.running)).toBe(true)
  })
})

describe('one drainer, one job at a time', () => {
  it('a live lease keeps a second worker off the same source', async () => {
    const { context, ops } = await setup(pickyAdapter())
    const first = (await (await enqueue(context, ops)).json()).job
    const second = (await (await enqueue(context, ops)).json()).job

    // Pretend another process is mid-page on the first job.
    await context.db.query(
      `UPDATE ingest_jobs SET status = 'running', locked_by = 'other:1',
         lease_expires_at = now() + interval '60 seconds' WHERE id = $1`,
      [first.id],
    )
    const blocked = await processJob(context.env, second.id)
    expect(blocked).toMatchObject({ id: second.id, status: 'queued', pagesDone: 0 })

    // Lease lapses (that process died) → the queue moves again.
    await context.db.query(
      "UPDATE ingest_jobs SET lease_expires_at = now() - interval '1 second' WHERE id = $1",
      [first.id],
    )
    expect(await processJob(context.env, second.id)).toMatchObject({ id: second.id, status: 'ok' })
  })

  it('a stalled claim is recoverable: an expired lease can be taken over, a live one cannot', async () => {
    const { context, ops } = await setup(pickyAdapter())
    const { job } = await (await enqueue(context, ops)).json()
    await context.db.query(
      `UPDATE ingest_jobs SET status = 'running', locked_by = 'ghost:9',
         lease_expires_at = now() + interval '60 seconds' WHERE id = $1`,
      [job.id],
    )
    const held = await processJob(context.env, job.id)
    expect(held).toMatchObject({ status: 'running', pagesDone: 0 })

    await context.db.query(
      "UPDATE ingest_jobs SET lease_expires_at = now() - interval '1 second' WHERE id = $1",
      [job.id],
    )
    const taken = await processJob(context.env, job.id)
    expect(taken).toMatchObject({ status: 'ok', pagesDone: 1 })
    const row = await context.db.query('SELECT locked_by, lease_expires_at FROM ingest_jobs WHERE id = $1', [job.id])
    expect(row.rows[0].locked_by).toBeNull()
    expect(row.rows[0].lease_expires_at).toBeNull()
  })

  it('only one loop drains: a second loop in the same cluster idles instead of fanning out', async () => {
    const { context, ops } = await setup(pickyAdapter())
    const { job } = await (await enqueue(context, ops)).json()

    const stopA = startIngestWorker(context.env, { intervalMs: 50 })
    const stopB = startIngestWorker(context.env, { intervalMs: 50 })
    try {
      const deadline = Date.now() + 5_000
      let status = ''
      while (Date.now() < deadline && status !== 'ok') {
        await new Promise((resolve) => setTimeout(resolve, 100))
        const { rows } = await context.db.query('SELECT status FROM ingest_jobs WHERE id = $1', [job.id])
        status = rows[0].status
      }
      expect(status).toBe('ok')
      // One page fetched once: no duplicate creators, no double quota.
      const { rows } = await context.db.query(
        'SELECT pages_done, quota_used FROM ingest_jobs WHERE id = $1',
        [job.id],
      )
      expect(Number(rows[0].pages_done)).toBe(1)
      expect(Number(rows[0].quota_used)).toBe(1)
      const raws = await context.db.query("SELECT count(*)::int AS n FROM creator_raw WHERE source = 'qiangua'")
      expect(raws.rows[0].n).toBe(1)
    } finally {
      stopA()
      stopB()
    }
  }, 20_000)

  it('picks up a run abandoned mid-page once its lease lapses', async () => {
    const { context, ops } = await setup(pickyAdapter())
    const { job } = await (await enqueue(context, ops)).json()
    // A drainer claimed it, wrote a page, then died.
    await context.db.query(
      `UPDATE ingest_jobs SET status = 'running', pages_done = 0, locked_by = 'gone:1',
         lease_expires_at = now() - interval '1 second' WHERE id = $1`,
      [job.id],
    )
    const stop = startIngestWorker(context.env, { intervalMs: 50 })
    try {
      const deadline = Date.now() + 5_000
      let status = 'running'
      while (Date.now() < deadline && status !== 'ok') {
        await new Promise((resolve) => setTimeout(resolve, 100))
        const { rows } = await context.db.query('SELECT status FROM ingest_jobs WHERE id = $1', [job.id])
        status = rows[0].status
      }
      expect(status).toBe('ok')
    } finally {
      stop()
    }
  }, 20_000)

  it('leaves an abandoned run alone while its lease is still good', async () => {
    const { context, ops } = await setup(pickyAdapter())
    const { job } = await (await enqueue(context, ops)).json()
    await context.db.query(
      `UPDATE ingest_jobs SET status = 'running', locked_by = 'busy:1',
         lease_expires_at = now() + interval '60 seconds' WHERE id = $1`,
      [job.id],
    )
    const stop = startIngestWorker(context.env, { intervalMs: 50 })
    try {
      await new Promise((resolve) => setTimeout(resolve, 600))
      const { rows } = await context.db.query(
        'SELECT status, locked_by FROM ingest_jobs WHERE id = $1',
        [job.id],
      )
      expect(rows[0]).toMatchObject({ status: 'running', locked_by: 'busy:1' })
    } finally {
      stop()
    }
  })

  it('INGEST_WORKER=0 keeps a process out of the rotation entirely', async () => {
    const { context, ops } = await setup(pickyAdapter())
    const { job } = await (await enqueue(context, ops)).json()
    process.env.INGEST_WORKER = '0'
    const stop = startIngestWorker(context.env, { intervalMs: 50 })
    try {
      await new Promise((resolve) => setTimeout(resolve, 400))
      const { rows } = await context.db.query('SELECT status FROM ingest_jobs WHERE id = $1', [job.id])
      expect(rows[0].status).toBe('queued')
    } finally {
      stop()
      delete process.env.INGEST_WORKER
    }
  })
})
