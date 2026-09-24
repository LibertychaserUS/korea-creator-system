import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { billedCall, VendorTimeoutError } from '../src/adapters/billing'
import { VendorHttpError } from '../src/adapters/common'
import { pgyTimeoutMs, pugongyingAdapter } from '../src/adapters/pugongying'
import { pipelineReport } from '../src/routes/dev-console'
import { processJob } from '../src/ingest/worker'
import { dailyBudget, vendorPriceOverrides } from '../src/ingest/meter'
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

/** Every pgy endpoint answers; detail per user, the four data sections with a little data. */
function healthyVendor() {
  return stubVendor((path, body) => {
    if (path.endsWith('get_blogger_detail')) return tikhubOk(DETAIL(String(body.user_id)))
    return tikhubOk({ noteNumber: 3 })
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
    // Creator 1 = detail + 4 sections; creator 2 got 2 calls in before the 8th was refused.
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
    expect(done).toMatchObject({ status: 'ok', writtenCount: 3, quotaUsed: 17 })
    expect(sent.filter((c) => c.path.endsWith('get_blogger_detail')).map((c) => c.body.user_id)).toEqual(['u2', 'u3'])
  })

  it('stops at the daily money budget → partial BUDGET_EXHAUSTED; the ops console shows calls and money', async () => {
    const context = await setup()
    await context.db.query("UPDATE ingest_sources SET daily_budget_usd = 0.1 WHERE id = 'pugongying'")
    const sent = healthyVendor()
    const job = await refreshJob(context, ['u1', 'u2'])
    const stopped = await processJob(context.env, job.id)
    expect(sent).toHaveLength(5)
    expect(stopped).toMatchObject({ status: 'partial', errorCode: 'BUDGET_EXHAUSTED', error: 'budget_exhausted', cursor: '@1', quotaUsed: 5 })
    expect(new Date(stopped!.nextRunAt!).getTime()).toBeGreaterThan(Date.now())

    const report = await pipelineReport(context.env)
    const pgy = report.sources.find((s) => s.id === 'pugongying')!
    expect(pgy).toMatchObject({ callsToday: 5, requestsToday: 5, dailyBudgetUsd: 0.1, budgetFrom: 'source' })
    expect(pgy.costTodayUsd).toBeCloseTo(0.1, 6)
    expect(pgy.budgetRatio).toBeCloseTo(1, 6)
    expect(pgy.recentDays.at(-1)).toMatchObject({ calls: 5 })
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
      return tikhubOk({ noteNumber: 3 })
    })
    const job = await refreshJob(context, ['gone', 'u1'])
    const done = await processJob(context.env, job.id)
    expect(done).toMatchObject({ status: 'ok', writtenCount: 1, quotaUsed: 6, emptyCount: 1 })
    expect(await usage(context)).toMatchObject({ calls: 6, cost: 120_000, empty_results: 1 })
  })

  it('takes one rate token per call, not per page', async () => {
    const context = await setup()
    await context.db.query("UPDATE ingest_sources SET rate_limit = 600 WHERE id = 'pugongying'")
    healthyVendor()
    const job = await refreshJob(context, ['u1', 'u2'])
    await processJob(context.env, job.id)
    const bucket = await context.db.query("SELECT tokens FROM ingest_rate_buckets WHERE source = 'pugongying'")
    // 10 calls taken from a bucket of 600 (a little refill while the job ran).
    expect(Number(bucket.rows[0].tokens)).toBeGreaterThanOrEqual(589)
    expect(Number(bucket.rows[0].tokens)).toBeLessThan(592)
  })

  it('a shutdown mid-page hands the job back with a resume cursor, and nothing is sent after the stop', async () => {
    const context = await setup()
    const sent = healthyVendor()
    const job = await refreshJob(context, ['u1', 'u2'])
    let n = 0
    const requeued = await processJob(context.env, job.id, { shouldStop: () => ++n > 7 })
    expect(requeued).toMatchObject({ status: 'queued', cursor: '@1', writtenCount: 1 })
    expect(sent.length).toBeLessThan(10)
  })
})

describe('reading TikHub answers', () => {
  const failedPgy = (code: number, msg: string) => ({ body: { code: 200, request_id: 'req-inner', data: { code, success: false, msg, data: null } } })

  it('a 200 whose 蒲公英 body says success=false is billed, not retried, and parked', async () => {
    const context = await setup()
    stubVendor(() => failedPgy(-1, '参数错误'))
    const token = (await context.loginJson('ops@kcs.local')).token
    const response = await context.app.request('/api/ingest/fetch', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'pugongying', window: 30, keyword: '护肤', maxPages: 1 }),
    })
    const { job } = await response.json()
    const failed = await processJob(context.env, job.id)
    expect(failed).toMatchObject({ status: 'failed', errorCode: 'VENDOR_INNER_ERROR', attempts: 1, quotaUsed: 1 })
    expect(failed!.error).toBe('pugongying inner error -1: 参数错误')
    const parked = await context.db.query("SELECT code FROM ingest_dead_letters WHERE job_id = $1", [job.id])
    expect(parked.rows).toEqual([{ code: 'VENDOR_INNER_ERROR' }])
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
      if (path.endsWith('get_blogger_notes_rate')) return failedPgy(500, '服务繁忙')
      if (path.endsWith('get_blogger_fans_profile')) return tikhubOk(null, 'req-empty')
      return tikhubOk({ noteNumber: 3 })
    })
    const job = await refreshJob(context, ['u1'])
    const done = await processJob(context.env, job.id)
    expect(done).toMatchObject({ status: 'ok', writtenCount: 1, emptyCount: 1, quotaUsed: 5 })
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
      return tikhubOk({ noteNumber: 3 })
    })
    const job = await refreshJob(context, ['u1', 'u2'])
    const retry = await processJob(context.env, job.id)
    expect(retry).toMatchObject({ status: 'queued', errorCode: 'SOURCE_UNAVAILABLE', cursor: '@1', writtenCount: 1 })
    // 5 + detail, 2 sections billed; the 503 was free.
    expect(await usage(context)).toMatchObject({ calls: 8, requests: 9, unbilled: 1 })
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
    expect(retry).toMatchObject({ status: 'queued', quotaUsed: 1 })
    expect(retry!.error).toBe('pugongying timeout after 150ms (may have been billed)')
    expect(await usage(context)).toMatchObject({ calls: 1, maybe_billed: 1 })
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
