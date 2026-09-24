import { afterEach, describe, expect, it, vi } from 'vitest'
import pg from 'pg'
import {
  creatorKeyFor,
  emptyMetrics,
  INGEST_QUEUE_LOCK,
  type SourceAdapter,
  type SourceQuery,
} from '@kcs/contract'
import { createApp, type AppEnv } from '../src/app'
import { SessionCache } from '../src/http/session-cache'
import { enqueueIngestJob, processJob, startIngestWorker } from '../src/ingest/worker'
import { createShutdown } from '../src/shutdown'
import { MemoryObjectStore } from '../src/store'
import { createTestApp, type TestCtx } from './helpers'

const contexts: TestCtx[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  process.env.LOG_REQUESTS = '0'
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function logLines(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls
    .map((call) => String(call[0]))
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

function fakeEnv(query: (sql: string) => Promise<unknown>, extra: Partial<AppEnv> = {}): AppEnv {
  return {
    db: { query } as unknown as AppEnv['db'],
    store: new MemoryObjectStore(),
    now: () => new Date(),
    verifySession: async () => ({
      id: 'user_selector',
      orgId: 'org_platform',
      email: 'selector@kcs.local',
      role: 'selector',
      displayName: 'S',
    }),
    ...extra,
  }
}

const healthyDb = async () => ({ rows: [{ '?column?': 1 }], rowCount: 1 })
const brokenDb = async () => {
  throw new Error('connect ECONNREFUSED password=hunter2')
}

describe('session cache', () => {
  it('evicts the least recently used entry past the cap; a read refreshes recency', () => {
    const cache = new SessionCache<string>(3)
    cache.set('a', 'A', 1_000)
    cache.set('b', 'B', 1_000)
    cache.set('c', 'C', 1_000)
    expect(cache.get('a', 0)?.value).toBe('A')
    cache.set('d', 'D', 1_000)
    expect(cache.size).toBe(3)
    expect(cache.get('b', 0)).toBeUndefined()
    expect(['a', 'c', 'd'].map((key) => cache.get(key, 0)?.value)).toEqual(['A', 'C', 'D'])
  })

  it('an expired entry reads as missing and sweep drops every expired one', () => {
    const cache = new SessionCache<string | null>(10)
    cache.set('old', 'X', 100)
    cache.set('miss', null, 150)
    cache.set('fresh', 'Y', 1_000)
    expect(cache.get('old', 100)).toBeUndefined()
    expect(cache.get('miss', 120)).toEqual({ value: null })
    expect(cache.sweep(200)).toBe(1)
    expect(cache.size).toBe(1)
    expect(cache.get('fresh', 200)?.value).toBe('Y')
  })
})

describe('health', () => {
  it('readiness runs select 1 and reports db + version', async () => {
    const seen: string[] = []
    const app = createApp(fakeEnv(async (sql) => {
      seen.push(sql)
      return healthyDb()
    }))
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, db: 'ok' })
    expect(typeof body.version).toBe('string')
    expect(seen).toContain('select 1')
  })

  it('readiness is 503 when the DB is down; liveness stays 200', async () => {
    const app = createApp(fakeEnv(brokenDb))
    const ready = await app.request('/api/health')
    expect(ready.status).toBe(503)
    expect(await ready.json()).toMatchObject({ ok: false, db: 'down' })
    const live = await app.request('/api/health/live')
    expect(live.status).toBe(200)
    expect(await live.json()).toMatchObject({ ok: true })
  })

  it('while draining: readiness 503, every other request 503 UNAVAILABLE', async () => {
    const lifecycle = { draining: true }
    const app = createApp(fakeEnv(healthyDb, { lifecycle }))
    const ready = await app.request('/api/health')
    expect(ready.status).toBe(503)
    expect(await ready.json()).toMatchObject({ ok: false, db: 'ok', draining: true })
    const pool = await app.request('/api/select/pool', { headers: { authorization: 'Bearer t' } })
    expect(pool.status).toBe(503)
    expect((await pool.json()).error.code).toBe('UNAVAILABLE')
  })
})

describe('request and error logs', () => {
  it('logs method, path, status and duration as one JSON line; healthy probes are skipped', async () => {
    process.env.LOG_REQUESTS = '1'
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const app = createApp(fakeEnv(healthyDb))
    await app.request('/api/health')
    await app.request('/api/metrics/fields?x=1')
    const lines = logLines(spy).filter((line) => line.event === 'http.request')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ level: 'info', method: 'GET', path: '/api/metrics/fields', status: 200 })
    expect(typeof lines[0].ms).toBe('number')
  })

  it('LOG_REQUESTS=0 turns the request log off', async () => {
    process.env.LOG_REQUESTS = '0'
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const app = createApp(fakeEnv(healthyDb))
    await app.request('/api/metrics/fields')
    expect(logLines(spy).filter((line) => line.event === 'http.request')).toEqual([])
  })

  it('an unhandled error is logged structured and without credentials', async () => {
    process.env.LOG_REQUESTS = '0'
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const app = createApp(fakeEnv(brokenDb))
    const res = await app.request('/api/select/pool', { headers: { authorization: 'Bearer t' } })
    expect(res.status).toBe(500)
    const [line] = logLines(spy).filter((entry) => entry.event === 'http.unhandled')
    expect(line).toMatchObject({ level: 'error', method: 'GET', path: '/api/select/pool' })
    expect(JSON.stringify(line)).not.toContain('hunter2')
    expect(String(line.message)).toContain('password=***')
  })
})

function slowAdapter(calls: string[], pageMs = 150): SourceAdapter {
  return {
    id: 'qiangua',
    supports: ['cursor'],
    provides: ['followers'],
    async fetch(query: SourceQuery) {
      const page = query.cursor ? Number(query.cursor) : 1
      calls.push(String(page))
      await sleep(pageMs)
      return {
        records: [{ source: 'qiangua', platform: 'xhs', externalId: `slow-${page}`, fetchedAt: new Date().toISOString(), payload: { page } }],
        nextCursor: String(page + 1),
      }
    },
    normalize(raw) {
      return {
        ok: true,
        creator: {
          creatorKey: creatorKeyFor('xhs', raw.externalId),
          externalId: raw.externalId,
          platform: 'xhs',
          displayName: raw.externalId,
          xhsId: null,
          avatarUrl: null,
          regions: [],
          verticals: [],
          metrics: { ...emptyMetrics(30), followers: 1_000 },
          warnings: [],
        },
      }
    },
  }
}

function failingAdapter(): SourceAdapter {
  return {
    ...slowAdapter([]),
    async fetch() {
      throw new Error('qiangua HTTP 500 https://vendor/x?token=sekrit')
    },
  }
}

async function ctxWith(adapter: SourceAdapter) {
  const context = await createTestApp({ getAdapter: (source) => (source === adapter.id ? adapter : undefined) })
  contexts.push(context)
  await context.db.query('DELETE FROM ingest_jobs')
  return context
}

describe('worker', () => {
  it('stop(): the running job goes back to queued at a page boundary with its cursor; lease and lock released', async () => {
    const calls: string[] = []
    const context = await ctxWith(slowAdapter(calls))
    const job = await enqueueIngestJob(context.env, { source: 'qiangua', window: 30 } as SourceQuery, 'user_ops', 50)
    const stop = startIngestWorker(context.env, { intervalMs: 20, retention: { rawPerSource: 0, deadLetterDays: 0, auditDays: 0, jobDays: 0, intervalMs: 0 } })

    const deadline = Date.now() + 5_000
    let row: Record<string, any> = {}
    while (Date.now() < deadline) {
      row = (await context.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [job!.id])).rows[0]
      if (Number(row.pages_done) >= 1) break
      await sleep(20)
    }
    expect(Number(row.pages_done)).toBeGreaterThanOrEqual(1)

    await stop()
    const callsAtStop = calls.length
    row = (await context.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [job!.id])).rows[0]
    expect(row).toMatchObject({ status: 'queued', locked_by: null, lease_expires_at: null, next_run_at: null })
    expect(row.cursor).toBe(String(Number(row.pages_done) + 1))

    const probe = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL })
    await probe.connect()
    try {
      const { rows } = await probe.query('SELECT pg_try_advisory_lock($1) AS ok', [INGEST_QUEUE_LOCK])
      expect(rows[0].ok).toBe(true)
      await probe.query('SELECT pg_advisory_unlock($1)', [INGEST_QUEUE_LOCK])
    } finally {
      await probe.end()
    }
    await sleep(200)
    expect(calls.length).toBe(callsAtStop)

    const resumed = await processJob(context.env, job!.id, { shouldStop: () => calls.length >= callsAtStop + 1 })
    expect(resumed).toMatchObject({ status: 'queued' })
    expect(calls[callsAtStop]).toBe(row.cursor)
  }, 20_000)

  it('a failed attempt is logged with job id, source and code, never the credential', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const context = await ctxWith(failingAdapter())
    const job = await enqueueIngestJob(context.env, { source: 'qiangua', window: 30 } as SourceQuery, 'user_ops', 1)
    await processJob(context.env, job!.id)
    const [line] = logLines(warn).filter((entry) => entry.event === 'ingest.job_failed')
    expect(line).toMatchObject({ jobId: job!.id, source: 'qiangua', code: 'SOURCE_UNAVAILABLE', attempt: 1, willRetry: true })
    expect(JSON.stringify(line)).not.toContain('sekrit')
  })
})

describe('graceful shutdown', () => {
  function deps(overrides: Partial<Parameters<typeof createShutdown>[0]> = {}) {
    const order: string[] = []
    const lifecycle = { draining: false }
    const exit = vi.fn((code: number) => order.push(`exit:${code}`))
    return {
      order,
      lifecycle,
      exit,
      deps: {
        server: { close: (done: () => void) => { order.push('server.close'); setTimeout(done, 10) } },
        stopWorker: async () => { order.push('worker.stop'); await sleep(20); order.push('worker.stopped') },
        db: { end: async () => { order.push('db.end') } },
        lifecycle,
        timeoutMs: 1_000,
        exit,
        ...overrides,
      },
    }
  }

  it('drains, stops the worker, closes the server, then the pool, and exits 0', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const t = deps()
    const shutdown = createShutdown(t.deps)
    const done = shutdown('SIGTERM')
    expect(t.lifecycle.draining).toBe(true)
    await done
    expect(t.order.indexOf('db.end')).toBeGreaterThan(t.order.indexOf('worker.stopped'))
    expect(t.order).toContain('server.close')
    expect(t.order.at(-1)).toBe('exit:0')
  })

  it('caps the wait: a worker that never stops still ends in exit 1 with the pool closed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const t = deps({ stopWorker: () => new Promise<void>(() => undefined), timeoutMs: 50 })
    const started = Date.now()
    await createShutdown(t.deps)('SIGTERM')
    expect(Date.now() - started).toBeLessThan(1_500)
    expect(t.order).toContain('db.end')
    expect(t.order.at(-1)).toBe('exit:1')
  })

  it('a second signal exits at once', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const t = deps({ stopWorker: () => sleep(300) })
    const shutdown = createShutdown(t.deps)
    const first = shutdown('SIGTERM')
    void shutdown('SIGINT')
    expect(t.exit).toHaveBeenCalledWith(1)
    await first
  })
})
