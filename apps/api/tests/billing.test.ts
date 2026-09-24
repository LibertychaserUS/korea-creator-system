import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { billedCall, VendorTimeoutError } from '../src/adapters/billing'
import { VendorHttpError } from '../src/adapters/common'
import { pgyTimeoutMs, pugongyingAdapter, untilShanghaiMidnight } from '../src/adapters/pugongying'
import { pipelineReport } from '../src/routes/dev-console'
import { processJob } from '../src/ingest/worker'
import { dailyBudget, vendorPriceOverrides } from '../src/ingest/meter'
import { sourceScope } from '../src/ingest/scope'
import { checkVendorBalance } from '../src/ingest/balance'
import { createTestApp, type TestCtx } from './helpers'
import { recordingMeter } from './meter-stub'

const contexts: TestCtx[] = []
const saved = { ...process.env }

afterEach(async () => {
  process.env = { ...saved }
  vi.unstubAllGlobals()
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> }

/** TikHub-shaped answers: outer `{code, request_id, data}` around the pgy `{code, success, data}`. */
function tikhubOk(data: unknown, requestId = 'req-1') {
  return { body: { code: 200, request_id: requestId, message: 'Request successful.', data: { code: 0, success: true, msg: '', data } } }
}

const DETAIL = (userId: string) => ({ userId, name: `博主${userId}`, fansNum: 12000, redId: `red_${userId}` })

/** A data section with a little data; the 数据概览 carries a cost estimate so cost stays on 合作笔记 (no fallback call). */
function section(path: string, extra: Record<string, unknown> = {}) {
  return tikhubOk(path.endsWith('get_blogger_data_summary') ? { noteNumber: 3, estimatePictureEngageCost: 120, ...extra } : { noteNumber: 3, ...extra })
}

function stubVendor(reply: (path: string, body: Record<string, unknown>) => Reply | Promise<Reply>) {
  const sent: { path: string; body: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname
    const body = init.body ? JSON.parse(String(init.body)) : {}
    sent.push({ path, body })
    const r = await reply(path, body)
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'content-type': 'application/json', ...r.headers } })
  }))
  return sent
}

/** Every pgy endpoint answers; detail per user, the data sections with a little data. */
function healthyVendor() {
  return stubVendor((path, body) => {
    if (path.endsWith('get_blogger_detail')) return tikhubOk(DETAIL(String(body.user_id)))
    return section(path)
  })
}

async function setup() {
  process.env.TIKHUB_API_KEY = ''
  process.env.PGY_ACCESS_TOKEN = 'test-token'
  process.env.PGY_GATEWAY = 'tikhub'
  delete process.env.PGY_BASE_URL
  delete process.env.PGY_ENRICH
  delete process.env.PGY_DAILY_BUDGET_USD
  delete process.env.KCS_VENDOR_PRICES
  const context = await createTestApp()
  contexts.push(context)
  await context.db.query("UPDATE ingest_sources SET quota = 1000, rate_limit = 6000, daily_budget_usd = 5 WHERE id = 'pugongying'")
  return context
}

async function refreshJob(context: TestCtx, ids: string[]) {
  const token = (await context.loginJson('ops@kcs.local')).token
  const response = await context.app.request('/api/ingest/fetch', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ source: 'pugongying', window: 30, externalIds: ids, maxPages: 1 }),
  })
  expect(response.status).toBe(202)
  return (await response.json()).job as { id: string }
}

async function usage(context: TestCtx) {
  const { rows } = await context.db.query(
    `SELECT calls, cost_micros::int AS cost, requests, unbilled, maybe_billed, empty_results
       FROM ingest_source_usage WHERE source = 'pugongying'`,
  )
  return rows[0] ?? { calls: 0, cost: 0, requests: 0, unbilled: 0, maybe_billed: 0, empty_results: 0 }
}

describe('billed calls through the queue (蒲公英 via TikHub)', () => {
  it('reserves every call before it is sent: a quota of 7 stops at exactly 7, mid-creator, and keeps what was paid for', async () => {
    const context = await setup()
    await context.db.query("UPDATE ingest_sources SET quota = 7 WHERE id = 'pugongying'")
    const sent = healthyVendor()
    const job = await refreshJob(context, ['u1', 'u2', 'u3'])
    const stopped = await processJob(context.env, job.id)
    // Creator 1 = detail + 5 sections (the 含投放 reference is the 5th); creator 2 got its detail in before the 8th was refused.
    expect(sent).toHaveLength(7)
    expect(stopped).toMatchObject({ status: 'partial', errorCode: 'QUOTA_EXHAUSTED', cursor: '@1', quotaUsed: 7, vendorRequests: 7, pagesDone: 0 })
    expect(stopped!.costUsd).toBeCloseTo(0.14, 6)
    expect(stopped!.writtenCount).toBe(1)
    expect(await usage(context)).toMatchObject({ calls: 7, cost: 140_000, requests: 7 })

    // Next quota day: continues at creator 2, not creator 1.
    await context.db.query("UPDATE ingest_sources SET quota = 1000 WHERE id = 'pugongying'")
    await context.db.query("UPDATE ingest_jobs SET next_run_at = now() WHERE id = $1", [job.id])
    sent.length = 0
    const done = await processJob(context.env, job.id)
    expect(done).toMatchObject({ status: 'ok', writtenCount: 3, quotaUsed: 19 })
    expect(sent.filter((c) => c.path.endsWith('get_blogger_detail')).map((c) => c.body.user_id)).toEqual(['u2', 'u3'])
  })

  it('stops at the daily money budget → partial BUDGET_EXHAUSTED; the ops console shows calls and money', async () => {
    const context = await setup()
    await context.db.query("UPDATE ingest_sources SET daily_budget_usd = 0.12 WHERE id = 'pugongying'")
    const sent = healthyVendor()
    const job = await refreshJob(context, ['u1', 'u2'])
    const stopped = await processJob(context.env, job.id)
    expect(sent).toHaveLength(6)
    expect(stopped).toMatchObject({ status: 'partial', errorCode: 'BUDGET_EXHAUSTED', error: 'budget_exhausted', cursor: '@1', quotaUsed: 6 })
    expect(new Date(stopped!.nextRunAt!).getTime()).toBeGreaterThan(Date.now())

    const report = await pipelineReport(context.env)
    const pgy = report.sources.find((s) => s.id === 'pugongying')!
    expect(pgy).toMatchObject({ callsToday: 6, requestsToday: 6, dailyBudgetUsd: 0.12, budgetFrom: 'source' })
    expect(pgy.costTodayUsd).toBeCloseTo(0.12, 6)
    expect(pgy.budgetRatio).toBeCloseTo(1, 6)
    expect(pgy.recentDays.at(-1)).toMatchObject({ calls: 6 })
  })

  it('PGY_DAILY_BUDGET_USD overrides the source row (and `none` lifts the cap)', async () => {
    const context = await setup()
    process.env.PGY_DAILY_BUDGET_USD = '0.04'
    const sent = healthyVendor()
    const job = await refreshJob(context, ['u1'])
    expect(await processJob(context.env, job.id)).toMatchObject({ status: 'partial', errorCode: 'BUDGET_EXHAUSTED', quotaUsed: 2 })
    expect(sent).toHaveLength(2)
    const pgy = (await pipelineReport(context.env)).sources.find((s) => s.id === 'pugongying')!
    expect(pgy).toMatchObject({ dailyBudgetUsd: 0.04, budgetFrom: 'env' })

    expect(dailyBudget('pugongying', '5', { PGY_DAILY_BUDGET_USD: 'none' })).toEqual({ usd: null, from: 'env' })
    expect(dailyBudget('pugongying', '5', { PGY_DAILY_BUDGET_USD: 'abc' })).toEqual({ usd: 5, from: 'source' })
    expect(dailyBudget('pugongying', null, {})).toEqual({ usd: null, from: null })
  })

  it('gives unbilled calls back: a TikHub 500 costs nothing, but is counted as a request', async () => {
    const context = await setup()
    stubVendor(() => ({ status: 500, body: { detail: 'upstream error', request_id: 'req-500' } }))
    const job = await refreshJob(context, ['u1'])
    const failed = await processJob(context.env, job.id)
    expect(failed).toMatchObject({ status: 'queued', errorCode: 'SOURCE_UNAVAILABLE', quotaUsed: 0, vendorRequests: 1, costUsd: 0 })
    expect(await usage(context)).toMatchObject({ calls: 0, cost: 0, requests: 1, unbilled: 1 })
  })

  it('bills and counts 200-with-no-data (查无结果) instead of skipping it silently', async () => {
    const context = await setup()
    stubVendor((path, body) => {
      if (path.endsWith('get_blogger_detail')) return tikhubOk(body.user_id === 'gone' ? null : DETAIL(String(body.user_id)))
      return section(path)
    })
    const job = await refreshJob(context, ['gone', 'u1'])
    const done = await processJob(context.env, job.id)
    expect(done).toMatchObject({ status: 'ok', writtenCount: 1, quotaUsed: 7, emptyCount: 1 })
    expect(await usage(context)).toMatchObject({ calls: 7, cost: 140_000, empty_results: 1 })
  })

  it('takes one rate token per call, not per page', async () => {
    const context = await setup()
    await context.db.query("UPDATE ingest_sources SET rate_limit = 600 WHERE id = 'pugongying'")
    healthyVendor()
    const job = await refreshJob(context, ['u1', 'u2'])
    await processJob(context.env, job.id)
    const bucket = await context.db.query("SELECT tokens FROM ingest_rate_buckets WHERE source = 'pugongying'")
    // 12 calls taken from a bucket of 600 (a little refill while the job ran).
    expect(Number(bucket.rows[0].tokens)).toBeGreaterThanOrEqual(587)
    expect(Number(bucket.rows[0].tokens)).toBeLessThan(590)
  })

  it('a shutdown mid-page hands the job back with a resume cursor, and nothing is sent after the stop', async () => {
    const context = await setup()
    const sent = healthyVendor()
    const job = await refreshJob(context, ['u1', 'u2'])
    let n = 0
    const requeued = await processJob(context.env, job.id, { shouldStop: () => ++n > 7 })
    expect(requeued).toMatchObject({ status: 'queued', cursor: '@1', writtenCount: 1 })
    expect(sent.length).toBeLessThan(12)
  })
})

describe('reading TikHub answers', () => {
  const failedPgy = (code: number, msg: string) => ({ body: { code: 200, request_id: 'req-inner', data: { code, success: false, msg, data: null } } })

  it('a 200 whose 蒲公英 body says success=false is billed, not retried, and parked', async () => {
    const context = await setup()
    stubVendor(() => failedPgy(-1, '参数错误'))
    const logged = vi.spyOn(console, 'error')
    const token = (await context.loginJson('ops@kcs.local')).token
    const response = await context.app.request('/api/ingest/fetch', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'pugongying', window: 30, keyword: '护肤', maxPages: 1 }),
    })
    const { job } = await response.json()
    const failed = await processJob(context.env, job.id)
    expect(failed).toMatchObject({ status: 'failed', errorCode: 'VENDOR_INNER_ERROR', attempts: 1, quotaUsed: 1 })
    // TikHub's request_id travels with the failure: job, dead letter and the failure log line.
    expect(failed!.error).toBe('pugongying inner error -1: 参数错误 (request_id req-inner)')
    const parked = await context.db.query("SELECT code, message FROM ingest_dead_letters WHERE job_id = $1", [job.id])
    expect(parked.rows).toEqual([{ code: 'VENDOR_INNER_ERROR', message: 'pugongying inner error -1: 参数错误 (request_id req-inner)' }])
    const line = logged.mock.calls.map((args) => String(args[0])).find((text) => text.includes('ingest.job_failed'))
    expect(JSON.parse(line!)).toMatchObject({ event: 'ingest.job_failed', code: 'VENDOR_INNER_ERROR', requestId: 'req-inner' })
    expect(await usage(context)).toMatchObject({ calls: 1, cost: 20_000 })
  })

  it('an outer TikHub code other than 200 is an inner failure too', async () => {
    stubVendor(() => ({ body: { code: 400, message: 'Invalid user_id', data: null } }))
    process.env.PGY_ACCESS_TOKEN = 'test-token'
    process.env.PGY_GATEWAY = 'tikhub'
    const error = await pugongyingAdapter.fetch({ source: 'pugongying', window: 30, keyword: 'x' }).catch((e) => e)
    expect(error.message).toBe('pugongying inner error 400: Invalid user_id')
  })

  it('an empty or refused data section keeps the creator, warns on it, and notes it on the job', async () => {
    const context = await setup()
    stubVendor((path, body) => {
      if (path.endsWith('get_blogger_detail')) return tikhubOk(DETAIL(String(body.user_id)))
      if (path.endsWith('get_blogger_notes_rate') && body.advertise_switch === 0) return failedPgy(500, '服务繁忙')
      if (path.endsWith('get_blogger_fans_profile')) return tikhubOk(null, 'req-empty')
      return section(path)
    })
    const job = await refreshJob(context, ['u1'])
    const done = await processJob(context.env, job.id)
    expect(done).toMatchObject({ status: 'ok', writtenCount: 1, emptyCount: 1, quotaUsed: 6 })
    expect(done!.vendorNotes).toEqual([
      { kind: 'innerError', endpoint: 'notesRate', externalId: 'u1', code: '500', message: '服务繁忙', requestId: 'req-inner' },
      { kind: 'empty', endpoint: 'fansProfile', externalId: 'u1', code: null, message: null, requestId: 'req-empty' },
    ])
    const raw = await context.db.query(
      `SELECT p.payload FROM creator_raw r JOIN raw_payloads p ON p.hash = r.payload_hash WHERE r.external_id = 'u1'`,
    )
    expect(raw.rows[0].payload.kcsEmpty).toEqual(['fansProfile'])
    expect(raw.rows[0].payload.kcsIssues).toMatchObject([{ section: 'notesRate', code: '500' }])
    const normalized = pugongyingAdapter.normalize({
      source: 'pugongying', platform: 'xhs', externalId: 'u1', fetchedAt: '2026-09-24T00:00:00Z',
      payload: { ...DETAIL('u1'), kcsEmpty: ['fansProfile'], kcsIssues: [{ section: 'notesRate' }] },
    })
    expect(normalized.ok && normalized.creator.warnings).toEqual(expect.arrayContaining(['fansProfile.empty', 'notesRate.fetchFailed']))
  })

  it('a 5xx on one data section is not swallowed: the page stops at that creator and the job retries from it', async () => {
    const context = await setup()
    stubVendor((path, body) => {
      if (path.endsWith('get_blogger_detail')) return tikhubOk(DETAIL(String(body.user_id)))
      if (path.endsWith('get_blogger_notes_rate') && body.user_id === 'u2') return { status: 503, body: { detail: 'busy' } }
      return section(path)
    })
    const job = await refreshJob(context, ['u1', 'u2'])
    const retry = await processJob(context.env, job.id)
    expect(retry).toMatchObject({ status: 'queued', errorCode: 'SOURCE_UNAVAILABLE', cursor: '@1', writtenCount: 1 })
    // 6 + detail, 2 sections billed; the 503 was free.
    expect(await usage(context)).toMatchObject({ calls: 9, requests: 10, unbilled: 1 })
  })

  it('times out after PGY_TIMEOUT_MS (default 60 s) and says the call may have been billed', async () => {
    expect(pgyTimeoutMs({})).toBe(60_000)
    expect(pgyTimeoutMs({ PGY_TIMEOUT_MS: '90000' })).toBe(90_000)
    expect(pgyTimeoutMs({ PGY_TIMEOUT_MS: 'x' })).toBe(60_000)
    const context = await setup()
    process.env.PGY_TIMEOUT_MS = '150'
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    })))
    const job = await refreshJob(context, ['u1'])
    const retry = await processJob(context.env, job.id)
    expect(retry).toMatchObject({ status: 'queued', quotaUsed: 1, errorCode: 'VENDOR_TIMEOUT' })
    expect(retry!.error).toBe('pugongying timeout after 150ms (may have been billed)')
    expect(await usage(context)).toMatchObject({ calls: 1, maybe_billed: 1 })
  })
})

describe('what each vendor answer means for the queue', () => {
  async function devToken(context: TestCtx) {
    return (await context.loginJson('devops@kcs.local')).token
  }

  it('402: the job is parked, the source pauses with an audit entry and a home-page alert, and resumes by hand', async () => {
    const context = await setup()
    stubVendor(() => ({ status: 402, body: { detail: 'Insufficient balance', request_id: 'req-402' } }))
    const job = await refreshJob(context, ['u1'])
    const waiting = await refreshJob(context, ['u2'])
    const failed = await processJob(context.env, job.id)
    expect(failed).toMatchObject({ status: 'failed', errorCode: 'BALANCE_EXHAUSTED', attempts: 1, quotaUsed: 0 })
    const parked = await context.db.query("SELECT kind, state, code, cursor FROM ingest_dead_letters WHERE job_id = $1", [job.id])
    expect(parked.rows).toEqual([{ kind: 'job', state: 'open', code: 'BALANCE_EXHAUSTED', cursor: '@0' }])
    const trail = await context.db.query("SELECT actor_id, summary FROM audit_logs WHERE action = 'source.paused' AND entity_id = 'pugongying'")
    expect(trail.rows).toEqual([{ actor_id: null, summary: 'BALANCE_EXHAUSTED: pugongying HTTP 402 (request_id req-402)' }])

    // Nothing else of the source runs while it is paused.
    expect(await processJob(context.env, waiting.id)).toMatchObject({ status: 'queued', quotaUsed: 0 })
    const token = await devToken(context)
    const health = await (await context.app.request('/api/dev/health', { headers: { authorization: `Bearer ${token}` } })).json()
    expect(health.pausedSources).toMatchObject([{ id: 'pugongying', code: 'BALANCE_EXHAUSTED', detail: 'pugongying HTTP 402 (request_id req-402)' }])
    const pipeline = (await pipelineReport(context.env)).sources.find((s) => s.id === 'pugongying')!
    expect(pipeline.pausedCode).toBe('BALANCE_EXHAUSTED')

    const opsToken = (await context.loginJson('ops@kcs.local')).token
    const forbidden = await context.app.request('/api/dev/sources/pugongying/resume', { method: 'POST', headers: { authorization: `Bearer ${opsToken}` } })
    expect(forbidden.status).toBe(403)
    const resumed = await context.app.request('/api/dev/sources/pugongying/resume', { method: 'POST', headers: { authorization: `Bearer ${token}` } })
    expect(await resumed.json()).toMatchObject({ id: 'pugongying', resumed: true, pausedSources: [] })
    const again = await context.app.request('/api/dev/sources/pugongying/resume', { method: 'POST', headers: { authorization: `Bearer ${token}` } })
    expect(await again.json()).toMatchObject({ resumed: false })
    const missing = await context.app.request('/api/dev/sources/nope/resume', { method: 'POST', headers: { authorization: `Bearer ${token}` } })
    expect(missing.status).toBe(404)
    const resumedTrail = await context.db.query("SELECT count(*)::int AS n FROM audit_logs WHERE action = 'source.resumed'")
    expect(resumedTrail.rows[0].n).toBe(1)

    // Topped up: the parked run replays from its cursor, the waiting one runs.
    healthyVendor()
    const entry = (await context.db.query("SELECT id FROM ingest_dead_letters WHERE job_id = $1", [job.id])).rows[0]
    const replay = await context.app.request(`/api/dev/dead-letters/${entry.id}/replay`, { method: 'POST', headers: { authorization: `Bearer ${token}` } })
    expect(replay.status).toBe(200)
    expect(await processJob(context.env, waiting.id)).toMatchObject({ status: 'ok', writtenCount: 1 })
  })

  it('401: the credential is wrong — permanent, not retried, and the source keeps running', async () => {
    const context = await setup()
    const sent = stubVendor(() => ({ status: 401, body: { detail: 'Invalid token' } }))
    const job = await refreshJob(context, ['u1'])
    expect(await processJob(context.env, job.id)).toMatchObject({ status: 'failed', errorCode: 'CREDENTIAL_INVALID', attempts: 1 })
    expect(sent).toHaveLength(1)
    const paused = await context.db.query("SELECT paused_at FROM ingest_sources WHERE id = 'pugongying'")
    expect(paused.rows[0].paused_at).toBeNull()
  })

  it('400: sent once more (free on TikHub); a second 400 is permanent', async () => {
    const context = await setup()
    let n = 0
    const sent = stubVendor((path, body) => {
      if (path.endsWith('get_blogger_detail') && n++ === 0) return { status: 400, body: { detail: 'bad request' } }
      return path.endsWith('get_blogger_detail') ? tikhubOk(DETAIL(String(body.user_id))) : section(path)
    })
    const job = await refreshJob(context, ['u1'])
    expect(await processJob(context.env, job.id)).toMatchObject({ status: 'ok', writtenCount: 1, quotaUsed: 6, vendorRequests: 7 })
    expect(sent.filter((c) => c.path.endsWith('get_blogger_detail'))).toHaveLength(2)

    const always = stubVendor(() => ({ status: 400, body: { detail: 'bad request' } }))
    const second = await refreshJob(context, ['u2'])
    expect(await processJob(context.env, second.id)).toMatchObject({ status: 'failed', errorCode: 'VENDOR_REJECTED', attempts: 1 })
    expect(always).toHaveLength(2)
  })

  it('429 honours Retry-After as the earliest retry and is free', async () => {
    const context = await setup()
    stubVendor(() => ({ status: 429, body: { detail: 'rate limited' }, headers: { 'retry-after': '30' } }))
    const job = await refreshJob(context, ['u1'])
    const retry = await processJob(context.env, job.id)
    expect(retry).toMatchObject({ status: 'queued', errorCode: 'SOURCE_UNAVAILABLE', quotaUsed: 0 })
    expect(new Date(retry!.nextRunAt!).getTime()).toBeGreaterThanOrEqual(Date.now() + 25_000)
  })
})

describe('billedCall', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('TikHub rule: 200 billed (empty data too), 4xx/5xx unbilled with status, Retry-After and request id', async () => {
    const billing = recordingMeter()
    const call = (reply: Reply) => {
      stubVendor(() => reply)
      return billedCall({ meter: billing.meter }, {
        source: 'pugongying',
        endpoint: 'tikhub:/api/v1/xiaohongshu/pgy/get_blogger_detail',
        url: 'https://api.tikhub.io/api/v1/xiaohongshu/pgy/get_blogger_detail',
        init: { method: 'POST', body: '{}' },
        rule: 'tikhub',
        timeoutMs: 1_000,
        read: (json) => {
          const data = ((json.data as Record<string, unknown> | null)?.data ?? null) as unknown
          return { value: data, empty: data == null }
        },
      })
    }
    expect(await call(tikhubOk({ userId: 'a' }, 'r-ok'))).toMatchObject({ empty: false, requestId: 'r-ok', status: 200 })
    expect(await call(tikhubOk(null, 'r-empty'))).toMatchObject({ empty: true, requestId: 'r-empty' })
    for (const status of [400, 401, 402, 429, 500]) {
      const error = await call({ status, body: { detail: 'x', request_id: `r-${status}` }, headers: status === 429 ? { 'retry-after': '3' } : {} }).catch((e) => e)
      expect(error).toBeInstanceOf(VendorHttpError)
      expect(error).toMatchObject({ status, requestId: `r-${status}`, message: `pugongying HTTP ${status}` })
      if (status === 429) expect(error.retryAfterMs).toBe(3_000)
    }
    expect(billing.settled.map((s) => s.outcome)).toEqual(['billed', 'billed', 'unbilled', 'unbilled', 'unbilled', 'unbilled', 'unbilled'])
    expect(billing.settled.map((s) => Boolean(s.empty))).toEqual([false, true, false, false, false, false, false])
  })

  it('a timeout after sending is `maybe` billed and says so; a refused connection is unbilled', async () => {
    const billing = recordingMeter()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    })))
    const request = {
      source: 'pugongying' as const,
      endpoint: 'tikhub:/api/v1/xiaohongshu/pgy/get_blogger_detail',
      url: 'https://api.tikhub.io/x',
      init: { method: 'POST' },
      rule: 'tikhub' as const,
      timeoutMs: 20,
      read: (json: Record<string, unknown>) => ({ value: json, empty: false }),
    }
    const timeout = await billedCall({ meter: billing.meter }, request).catch((e) => e)
    expect(timeout).toBeInstanceOf(VendorTimeoutError)
    expect(timeout.message).toBe('pugongying timeout after 20ms (may have been billed)')

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    }))
    const refused = await billedCall({ meter: billing.meter }, request).catch((e) => e)
    expect(refused.message).toBe('pugongying unreachable (ECONNREFUSED)')
    expect(billing.settled.map((s) => s.outcome)).toEqual(['maybe', 'unbilled'])
  })

  it('vendors without a published rule: every answer counts', async () => {
    const billing = recordingMeter()
    stubVendor(() => ({ status: 429, body: {} }))
    await billedCall({ meter: billing.meter }, {
      source: 'qiangua', endpoint: 'qiangua:/v1/x', url: 'https://q.example/v1/x', init: {}, rule: 'every-response', timeoutMs: 1_000,
      read: (json) => ({ value: json, empty: false }),
    }).catch(() => null)
    expect(billing.settled.map((s) => s.outcome)).toEqual(['billed'])
  })

  it('the 蒲公英 adapter stops the page at the meter and resumes from the cursor', async () => {
    process.env.PGY_ACCESS_TOKEN = 'test-token'
    process.env.PGY_GATEWAY = 'tikhub'
    healthyVendor()
    const billing = recordingMeter(6, 'budget')
    const page = await pugongyingAdapter.fetch({ source: 'pugongying', window: 30, externalIds: ['a', 'b', 'c'] }, { meter: billing.meter })
    expect(page.records.map((r) => r.externalId)).toEqual(['a'])
    expect(page.nextCursor).toBe('@1')
    expect(page.interrupted).toEqual({ reason: 'budget', resetsAt: '2026-09-25T16:00:00.000Z' })
    const resumed = await pugongyingAdapter.fetch({ source: 'pugongying', window: 30, externalIds: ['a', 'b', 'c'], cursor: '@1' })
    expect(resumed.records.map((r) => r.externalId)).toEqual(['b', 'c'])
    expect(resumed.nextCursor).toBeNull()
  })

  it('reads price overrides from KCS_VENDOR_PRICES and ignores a broken value', () => {
    expect(vendorPriceOverrides({ KCS_VENDOR_PRICES: '{"justoneapi:/api/":0.015,"bad":-1}' })).toEqual({ 'justoneapi:/api/': 0.015 })
    expect(vendorPriceOverrides({ KCS_VENDOR_PRICES: 'nope' })).toEqual({})
  })
})

describe('fetch scope (蒲公英 business / advertise_switch)', () => {
  it('the queue asks with the source row\'s scope, env overrides it, and the ops console shows which one is in force', async () => {
    const context = await setup()
    delete process.env.PGY_TRAFFIC_SCOPE
    delete process.env.PGY_BUSINESS_SCOPE
    await context.db.query("UPDATE ingest_sources SET traffic_scope = 'organic', business_scope = 'coop' WHERE id = 'pugongying'")
    const sent = healthyVendor()
    const job = await refreshJob(context, ['u1'])
    expect(await processJob(context.env, job.id)).toMatchObject({ status: 'ok', writtenCount: 1 })
    // Reach is read on 日常笔记 either way; the 含投放 reference is the second notes-rate call.
    expect(sent.filter((c) => c.path.endsWith('get_blogger_notes_rate')).map((c) => c.body)).toMatchObject([
      { business: 0, advertise_switch: 0 },
      { business: 0, advertise_switch: 1 },
    ])
    expect(sent.find((c) => c.path.endsWith('get_blogger_data_summary'))!.body).toMatchObject({ business: 1 })
    const { rows } = await context.db.query("SELECT metrics FROM creators WHERE creator_key LIKE '%u1'")
    expect(rows[0].metrics.basis).toMatchObject({ trafficScope: 'organic', businessScope: 'coop' })
    let pgy = (await pipelineReport(context.env)).sources.find((s) => s.id === 'pugongying')!
    expect(pgy.scope).toEqual({ traffic: 'organic', business: 'coop', from: { traffic: 'source', business: 'source' } })

    process.env.PGY_TRAFFIC_SCOPE = 'all'
    pgy = (await pipelineReport(context.env)).sources.find((s) => s.id === 'pugongying')!
    expect(pgy.scope).toEqual({ traffic: 'all', business: 'coop', from: { traffic: 'env', business: 'source' } })
    expect((await pipelineReport(context.env)).sources.find((s) => s.id === 'qiangua')!.scope).toBeNull()

    // Unknown values are skipped, not guessed; the column is checked by the database too.
    expect(sourceScope('pugongying', { traffic_scope: 'paid', business_scope: null }, { PGY_BUSINESS_SCOPE: 'x' })).toEqual({
      traffic: 'organic', business: 'coop', from: { traffic: 'default', business: 'default' },
    })
    await expect(context.db.query("UPDATE ingest_sources SET traffic_scope = 'paid' WHERE id = 'pugongying'")).rejects.toThrow()
  })
})

describe('TikHub balance monitor', () => {
  async function balanceSetup() {
    const context = await setup()
    process.env.PGY_ACCESS_TOKEN = ''
    process.env.TIKHUB_API_KEY = 'th-key'
    delete process.env.TIKHUB_BALANCE_ALERT_USD
    await context.db.query('DELETE FROM vendor_balance_checks')
    await context.db.query("DELETE FROM ingest_source_usage WHERE source = 'pugongying'")
    return context
  }
  const bearer = async (context: TestCtx, email: string) => ({ authorization: `Bearer ${(await context.loginJson(email)).token}` })

  it('reads the free account endpoint once a day, estimates days left, and warns under $5', async () => {
    const context = await balanceSetup()
    // Two days of spend at $1 each → $1 a day.
    await context.db.query(
      `INSERT INTO ingest_source_usage (source, day, calls, cost_micros) VALUES
         ('pugongying', (now() AT TIME ZONE 'Asia/Shanghai')::date - 1, 50, 1000000),
         ('pugongying', (now() AT TIME ZONE 'Asia/Shanghai')::date, 50, 1000000)`,
    )
    const sent = stubVendor((path) => path.endsWith('/api/v1/tikhub/user/get_user_info')
      ? { body: { code: 200, request_id: 'req-bal', data: { user_data: { balance: 3.5, free_credit: 0.5, email: 'x@y' } } } }
      : { status: 404 })
    const result = await checkVendorBalance(context.env)
    expect(result).toMatchObject({ ok: true, balanceUsd: 3.5, freeCreditUsd: 0.5, low: true, requestId: 'req-bal' })
    expect(sent).toEqual([{ path: '/api/v1/tikhub/user/get_user_info', body: {} }])
    // Free: nothing reserved against the quota or the budget.
    expect(await usage(context)).toMatchObject({ calls: 50, requests: 0 })

    const view = (await pipelineReport(context.env)).balance!
    expect(view).toMatchObject({ vendor: 'tikhub', ok: true, availableUsd: 4, alertBelowUsd: 5, low: true, avgDailyCostUsd: 1, daysLeft: 4, requestId: 'req-bal' })
    const logged = await context.db.query("SELECT actor_id, summary FROM audit_logs WHERE action = 'vendor.balance_low'")
    expect(logged.rows).toEqual([{ actor_id: null, summary: 'TikHub balance $4.00 < $5' }])

    const health = await (await context.app.request('/api/dev/health', { headers: await bearer(context, 'devops@kcs.local') })).json()
    expect(health.vendorBalance).toMatchObject({ low: true, daysLeft: 4 })

    process.env.TIKHUB_BALANCE_ALERT_USD = '2'
    expect((await pipelineReport(context.env)).balance).toMatchObject({ low: false, alertBelowUsd: 2 })
  })

  it('a failed check is recorded and shown, and the last good balance stays on screen', async () => {
    const context = await balanceSetup()
    stubVendor(() => ({ body: { code: 200, request_id: 'r1', data: { user_data: { balance: 40 } } } }))
    await checkVendorBalance(context.env)
    stubVendor(() => ({ status: 401, body: { detail: 'Invalid API key', request_id: 'r2' } }))
    expect(await checkVendorBalance(context.env)).toMatchObject({ ok: false })
    const view = (await pipelineReport(context.env)).balance!
    expect(view).toMatchObject({ ok: false, availableUsd: 40, low: false, daysLeft: null })
    expect(view.error).toMatch(/401/)
    expect(view.error).not.toContain('th-key')
  })

  it('checks on demand for dev.retry only; not TikHub → nothing is sent and nothing is shown', async () => {
    const context = await balanceSetup()
    stubVendor(() => ({ body: { code: 200, request_id: 'r', data: { user_data: { balance: 12 } } } }))
    const forbidden = await context.app.request('/api/dev/vendor-balance/check', { method: 'POST', headers: await bearer(context, 'ops@kcs.local') })
    expect(forbidden.status).toBe(403)
    const checked = await context.app.request('/api/dev/vendor-balance/check', { method: 'POST', headers: await bearer(context, 'devops@kcs.local') })
    expect(checked.status).toBe(200)
    expect(await checked.json()).toMatchObject({ ok: true, balance: { availableUsd: 12, low: false } })

    process.env.TIKHUB_API_KEY = ''
    const sent = stubVendor(() => ({ body: {} }))
    expect(await checkVendorBalance(context.env)).toEqual({ skipped: 'not_tikhub' })
    expect(sent).toHaveLength(0)
    expect((await pipelineReport(context.env)).balance).toBeNull()
    const skipped = await context.app.request('/api/dev/vendor-balance/check', { method: 'POST', headers: await bearer(context, 'devops@kcs.local') })
    expect(skipped.status).toBe(409)
  })
})

describe('refresh tiers (蒲公英)', () => {
  it('a scheduled refresh costs 3 calls: the slow fan sections and the 含投放 reference are carried over for a month; a manual refresh fetches all 6', async () => {
    const context = await setup()
    delete process.env.PGY_SLOW_REFRESH_DAYS
    delete process.env.PGY_ALL_TRAFFIC_REFERENCE_DAYS
    let profileEmpty = false
    const sent = stubVendor((path, body) => {
      if (path.endsWith('get_blogger_detail')) return tikhubOk(DETAIL(String(body.user_id)))
      if (path.endsWith('get_blogger_fans_summary')) return tikhubOk({ fansNum: 12000, readFansRate: '30.0', activeFansRate: '70.0' })
      if (path.endsWith('get_blogger_fans_profile')) return tikhubOk(profileEmpty ? {} : { gender: { female: 0.8 } })
      return section(path, { readMedian: 900 })
    })
    const endpoints = () => sent.map((c) => c.path.split('/').at(-1))
    const run = async (schedule: 'manual' | 'refresh') => {
      const job = await refreshJob(context, ['t1'])
      if (schedule === 'refresh') await context.db.query("UPDATE ingest_jobs SET schedule = 'refresh' WHERE id = $1", [job.id])
      sent.length = 0
      const done = await processJob(context.env, job.id)
      expect(done).toMatchObject({ status: 'ok', failedCount: 0 })
      expect(done!.writtenCount + done!.skippedDupes).toBe(1)
      const { rows } = await context.db.query(
        `SELECT COALESCE(r.payload, p.payload) AS payload FROM creator_raw r LEFT JOIN raw_payloads p ON p.hash = r.payload_hash
          WHERE r.external_id = 't1' ORDER BY r.fetched_at DESC, r.id DESC LIMIT 1`,
      )
      return rows[0].payload
    }

    const first = await run('manual')
    expect(endpoints()).toEqual([
      'get_blogger_detail', 'get_blogger_data_summary', 'get_blogger_fans_summary', 'get_blogger_notes_rate', 'get_blogger_fans_profile', 'get_blogger_notes_rate',
    ])
    expect(Object.keys(first.kcsSectionsAt).sort()).toEqual(['dataSummary', 'fansProfile', 'fansSummary', 'notesRate', 'notesRateAll'])

    const second = await run('refresh')
    expect(endpoints()).toEqual(['get_blogger_detail', 'get_blogger_data_summary', 'get_blogger_notes_rate'])
    expect(second.kcsCarried).toEqual(['fansSummary', 'fansProfile', 'notesRateAll'])
    expect(second.kcsSectionsAt.fansSummary).toBe(first.kcsSectionsAt.fansSummary)
    const { rows } = await context.db.query("SELECT metrics FROM creators WHERE creator_key LIKE '%:t1'")
    expect(rows[0].metrics.readFanRatio).toBeCloseTo(0.3, 6)
    expect(rows[0].metrics.audience.femaleRatio).toBe(0.8)

    // Too old (here: any age) → fetched again; the reference keeps its own clock.
    process.env.PGY_SLOW_REFRESH_DAYS = '0'
    const third = await run('refresh')
    expect(endpoints()).toHaveLength(5)
    expect(third.kcsCarried).toEqual(['notesRateAll'])
    process.env.PGY_ALL_TRAFFIC_REFERENCE_DAYS = 'off'
    const noReference = await run('refresh')
    expect(endpoints()).toHaveLength(5)
    expect(noReference.kcsCarried).toBeUndefined()
    delete process.env.PGY_ALL_TRAFFIC_REFERENCE_DAYS

    // A person asking for a refresh gets everything fresh.
    delete process.env.PGY_SLOW_REFRESH_DAYS
    await run('manual')
    expect(endpoints()).toHaveLength(6)

    // A section that came back empty last time is asked for again, not carried.
    profileEmpty = true
    expect((await run('manual')).kcsEmpty).toEqual(['fansProfile'])
    profileEmpty = false
    const fifth = await run('refresh')
    expect(endpoints()).toEqual(['get_blogger_detail', 'get_blogger_data_summary', 'get_blogger_notes_rate', 'get_blogger_fans_profile'])
    expect(fifth.kcsCarried).toEqual(['fansSummary', 'notesRateAll'])
  })

  it('a search page is one call unless PGY_ENRICH=1', async () => {
    const context = await setup()
    const sent = stubVendor((path) => path.endsWith('get_blogger_list')
      ? tikhubOk({ kols: [DETAIL('s1'), DETAIL('s2')], total: 5000 })
      : section(path))
    const token = (await context.loginJson('ops@kcs.local')).token
    const search = async () => {
      const response = await context.app.request('/api/ingest/fetch', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ source: 'pugongying', window: 30, keyword: '护肤', maxPages: 1 }),
      })
      const { job } = await response.json()
      sent.length = 0
      return processJob(context.env, job.id)
    }
    expect(await search()).toMatchObject({ status: 'ok', writtenCount: 2, quotaUsed: 1 })
    expect(sent).toHaveLength(1)
    process.env.PGY_ENRICH = '1'
    expect(await search()).toMatchObject({ quotaUsed: 11 })
    expect(sent).toHaveLength(11)
  })
})

describe('JustOneAPI body code (HTTP 200 either way)', () => {
  function stubJustOne(reply: (path: string, params: URLSearchParams) => Record<string, unknown>) {
    const sent: { path: string; params: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(url)
      sent.push({ path: parsed.pathname, params: parsed.searchParams })
      return new Response(JSON.stringify(reply(parsed.pathname, parsed.searchParams)), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    return sent
  }
  const justOne = async () => {
    const context = await setup()
    process.env.PGY_GATEWAY = 'justoneapi'
    return context
  }

  it('sends the string enums for business / noteType / dateType / advertiseSwitch', async () => {
    const context = await justOne()
    await context.db.query("UPDATE ingest_sources SET traffic_scope = 'organic', business_scope = 'coop' WHERE id = 'pugongying'")
    const sent = stubJustOne((path) => {
      if (path.includes('user/blogger')) return { code: 0, data: DETAIL('j1') }
      return { code: 0, data: path.endsWith('dataSummary/v1') ? { noteNumber: 3, estimatePictureEngageCost: 120 } : { noteNumber: 3 } }
    })
    const job = await refreshJob(context, ['j1'])
    expect(await processJob(context.env, job.id)).toMatchObject({ status: 'ok', quotaUsed: 6 })
    const notes = sent.filter((c) => c.path.endsWith('notesRate/v1')).map((c) => Object.fromEntries(c.params))
    expect(notes).toMatchObject([
      { userId: 'j1', business: 'DAILY_NOTE', noteType: 'PHOTO_TEXT_AND_VIDEO', dateType: 'DAY_30', advertiseSwitch: 'ORGANIC_ONLY' },
      { userId: 'j1', business: 'DAILY_NOTE', advertiseSwitch: 'ALL' },
    ])
    expect(sent.find((c) => c.path.endsWith('dataSummary/v1'))!.params.get('business')).toBe('COOPERATE_NOTE')
  })

  it('601 / 602 are like 402 (source paused), 100 like 401, 400 / 600 refused once, 301 / 302 / 500 / 303 retried, unknown codes are inner failures (noted, not retried)', async () => {
    const context = await justOne()
    const outcome = async (code: number) => {
      const sent = stubJustOne(() => ({ code, message: `code ${code}`, requestId: `jo-${code}` }))
      await context.db.query("UPDATE ingest_sources SET paused_at = NULL, paused_code = NULL, paused_detail = NULL WHERE id = 'pugongying'")
      const job = await refreshJob(context, [`j${code}`])
      const done = await processJob(context.env, job.id)
      const paused = (await context.db.query("SELECT paused_code FROM ingest_sources WHERE id = 'pugongying'")).rows[0].paused_code
      return { status: done!.status, errorCode: done!.errorCode, sent: sent.length, paused }
    }
    expect(await outcome(601)).toEqual({ status: 'failed', errorCode: 'BALANCE_EXHAUSTED', sent: 1, paused: 'BALANCE_EXHAUSTED' })
    expect(await outcome(602)).toMatchObject({ errorCode: 'BALANCE_EXHAUSTED', paused: 'BALANCE_EXHAUSTED' })
    expect(await outcome(100)).toEqual({ status: 'failed', errorCode: 'CREDENTIAL_INVALID', sent: 1, paused: null })
    expect(await outcome(400)).toEqual({ status: 'failed', errorCode: 'VENDOR_REJECTED', sent: 1, paused: null })
    expect(await outcome(600)).toMatchObject({ status: 'failed', errorCode: 'VENDOR_REJECTED', sent: 1 })
    for (const code of [301, 302, 500, 303]) {
      expect(await outcome(code)).toEqual({ status: 'queued', errorCode: 'SOURCE_UNAVAILABLE', sent: 1, paused: null })
    }
    // Like a TikHub inner failure on the detail: noted against the creator, not sent again, the run goes on.
    expect(await outcome(777)).toEqual({ status: 'ok', errorCode: null, sent: 1, paused: null })
    const notes = await context.db.query("SELECT vendor_notes FROM ingest_jobs WHERE query->'externalIds' ? 'j777'")
    expect(notes.rows[0].vendor_notes).toMatchObject([{ kind: 'innerError', endpoint: 'detail', externalId: 'j777', code: '777', requestId: 'jo-777' }])

    const logged = await context.db.query("SELECT error FROM ingest_jobs WHERE error_code = 'CREDENTIAL_INVALID'")
    expect(logged.rows[0].error).toBe('pugongying credential invalid (justoneapi code 100: code 100) (request_id jo-100)')
    const waits = await context.db.query(
      "SELECT query->'externalIds'->>0 AS id, next_run_at FROM ingest_jobs WHERE query->'externalIds' ?| array['j301', 'j303']",
    )
    const at = Object.fromEntries(waits.rows.map((row) => [row.id, new Date(row.next_run_at).getTime()]))
    expect(at.j303).toBeGreaterThan(at.j301)
  })

  it('303 (the gateway day quota) waits for 00:00 Asia/Shanghai', () => {
    expect(untilShanghaiMidnight(Date.parse('2026-09-24T15:00:00Z'))).toBe(60 * 60_000)
    expect(untilShanghaiMidnight(Date.parse('2026-09-24T16:00:00Z'))).toBe(24 * 60 * 60_000)
  })
})
