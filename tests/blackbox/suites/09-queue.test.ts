import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authed, login, type Session } from '../helpers/auth'
import { ERROR, PATHS } from '../helpers/contract'
import { errorCode, request, type Json } from '../helpers/http'
import { VENDOR_URL, vendorCalls } from '../helpers/mock-vendor'
import { closePool, sqlExec, sqlRead } from '../helpers/postgres'

/**
 * 抓取队列 — 端到端黑盒（04 抓取流水线与队列）。
 *
 * 需要 API 以 `QIANGUA_BASE_URL=http://127.0.0.1:7190 QIANGUA_TOKEN=blackbox-vendor-token`
 * 启动，把千瓜适配器接到 global-setup 起的替身供应商上；没有接上时，依赖多页 / 失败 /
 * 配额的用例会跳过并说明原因，其余用例照常跑。
 *
 * 来源的「每分钟次数」「日配额」和 partial 的续跑时间没有 HTTP 入口（运营端也不能改），
 * 这里用 SQL 直接拧这几个旋钮，其余全部走 HTTP 断言。
 */

const SOURCE = 'qiangua'
const RUN = `bb${Date.now().toString(36)}`
const WORKER_TICK_MS = 2_000

type Job = {
  id: string
  status: 'queued' | 'running' | 'ok' | 'partial' | 'failed'
  sourceId: string
  sourceMode: string | null
  pagesDone: number
  maxPages: number
  quotaUsed: number
  writtenCount: number
  skippedDupes: number
  failedCount: number
  attempts: number
  cursor: string | null
  nextRunAt: string | null
  error: string | null
  errorCode: string | null
  errorSummary: string | null
  createdAt: string
  startedAt: string | null
  endedAt: string | null
  query: Record<string, unknown> | null
}

let ops: Session
let devops: Session
let admin: Session
let selector: Session
let viewer: Session
let live = false
let skipReason = ''

const enqueued: string[] = []

async function fetchJob(
  session: Session,
  body: Record<string, unknown>,
  sync = false,
): Promise<{ status: number; job: Job; raw: Json }> {
  const res = await authed(session, 'POST', `${PATHS.ingestFetch}${sync ? '?sync=1' : ''}`, body)
  let job = (sync ? res.json : (res.json.job as Json)) as unknown as Job
  if (job?.id) enqueued.push(job.id)
  // ?sync=1 hands the job to the worker instead when that source is already busy.
  if (sync && job?.id && !settled(job)) job = await waitFor(job.id, settled)
  return { status: res.status, job, raw: res.json }
}

async function getJob(id: string, session: Session = ops): Promise<Job> {
  const res = await authed(session, 'GET', PATHS.ingestJob(id))
  expect(res.status).toBe(200)
  return res.json as unknown as Job
}

async function waitFor(
  id: string,
  predicate: (job: Job) => boolean,
  timeoutMs = 25_000,
  everyMs = 400,
): Promise<Job> {
  const deadline = Date.now() + timeoutMs
  let last = await getJob(id)
  while (!predicate(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, everyMs))
    last = await getJob(id)
  }
  if (!predicate(last)) {
    throw new Error(`job ${id} did not reach expected state in ${timeoutMs}ms; last=${JSON.stringify(last)}`)
  }
  return last
}

const settled = (job: Job) => ['ok', 'partial', 'failed'].includes(job.status)
const keyword = (label: string) => `${RUN}-${label}`
/** Demo data filters by keyword, so only the live vendor gets one. */
const params = (label: string, extra: Record<string, unknown> = {}) => ({
  source: SOURCE,
  window: 30,
  ...(live ? { keyword: keyword(label) } : {}),
  ...extra,
})
const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : Number.NaN)

async function todayUsage(): Promise<number> {
  const rows = await sqlRead<{ calls: number }>(
    `SELECT u.calls FROM ingest_source_usage u JOIN ingest_sources s ON s.id = u.source
      WHERE u.source = $1 AND u.day = (now() AT TIME ZONE s.quota_tz)::date`,
    [SOURCE],
  )
  return Number(rows[0]?.calls ?? 0)
}

async function setSource(patch: { quota?: number; rateLimit?: number }) {
  if (patch.quota != null) {
    await sqlExec('UPDATE ingest_sources SET quota = $2 WHERE id = $1', [SOURCE, patch.quota])
  }
  if (patch.rateLimit != null) {
    await sqlExec('UPDATE ingest_sources SET rate_limit = $2 WHERE id = $1', [SOURCE, patch.rateLimit])
  }
}

beforeAll(async () => {
  ;[ops, devops, admin, selector, viewer] = await Promise.all([
    login('ops'),
    login('devops'),
    login('platform_admin'),
    login('selector'),
    login('selector_viewer'),
  ])
  // Make sure the source row exists and has generous defaults before we start tweaking it.
  await fetchJob(ops, { source: SOURCE, window: 30, maxPages: 1 }, true)
  await setSource({ quota: 100_000, rateLimit: 600 })

  const adapters = await authed(ops, 'GET', PATHS.ingestAdapters)
  const qiangua = (adapters.json.items as Json[]).find((item) => item.id === SOURCE)
  if (!qiangua?.configured) {
    skipReason = `千瓜适配器未配置凭证（API 需带 QIANGUA_BASE_URL=${VENDOR_URL} QIANGUA_TOKEN 启动），只跑演示数据用例`
    return
  }
  try {
    const before = (await vendorCalls(keyword('probe'))).length
    const probe = await fetchJob(ops, { source: SOURCE, window: 30, keyword: keyword('probe'), maxPages: 1 }, true)
    const after = (await vendorCalls(keyword('probe'))).length
    live = probe.job.sourceMode === 'live' && after === before + 1
    if (!live) skipReason = `API 没有把千瓜请求打到替身供应商 ${VENDOR_URL}（sourceMode=${probe.job.sourceMode}）`
  } catch (error) {
    skipReason = `替身供应商 ${VENDOR_URL} 不可达：${String(error)}`
  }
}, 60_000)

afterAll(async () => {
  await setSource({ quota: 1_000, rateLimit: 60 })
  // Leave nothing spinning for the next suite.
  for (const id of enqueued) {
    const job = await getJob(id, admin).catch(() => null)
    if (job && ['queued', 'running'].includes(job.status)) {
      await authed(admin, 'POST', PATHS.ingestJobCancel(id))
    }
  }
  await closePool()
})

describe('队列 — 入队与任务记录', () => {
  it('提交抓取参数 → 202，任务带着完整初始状态入队（queued / 0 页 / 0 次额度 / 0 次重试）', async () => {
    const { status, job } = await fetchJob(ops, params('enqueue', { window: 90, maxPages: 3 }))
    expect(status).toBe(202)
    expect(job).toMatchObject({
      status: 'queued',
      sourceId: SOURCE,
      pagesDone: 0,
      quotaUsed: 0,
      attempts: 0,
      writtenCount: 0,
      cursor: null,
      error: null,
      errorCode: null,
      startedAt: null,
      endedAt: null,
      maxPages: 3,
    })
    expect(job.query).toMatchObject({ source: SOURCE, window: 90 })
    expect(Number.isNaN(ms(job.createdAt))).toBe(false)
  })

  it('任务列表按提交时间倒序，最新的在最前，详情与列表里是同一条记录', async () => {
    const first = await fetchJob(ops, params('order-a', { maxPages: 1 }))
    const second = await fetchJob(ops, params('order-b', { maxPages: 1 }))
    const list = await authed(ops, 'GET', PATHS.ingestJobs)
    expect(list.status).toBe(200)
    const items = list.json.items as Job[]
    const ia = items.findIndex((j) => j.id === first.job.id)
    const ib = items.findIndex((j) => j.id === second.job.id)
    expect(ia).toBeGreaterThanOrEqual(0)
    expect(ib).toBeGreaterThanOrEqual(0)
    expect(ib).toBeLessThan(ia)
    for (let i = 1; i < items.length; i += 1) {
      expect(ms(items[i - 1].createdAt)).toBeGreaterThanOrEqual(ms(items[i].createdAt))
    }
    const detail = await getJob(second.job.id)
    expect(detail.id).toBe(second.job.id)
    expect(detail.query).toEqual(items[ib].query)
  })

  it('目标页数会被收进 1–100：0 → 1，1000 → 100，不填 → 5', async () => {
    const low = await fetchJob(ops, params('clamp-low', { maxPages: 0 }))
    const high = await fetchJob(ops, params('clamp-high', { maxPages: 1000 }))
    const none = await fetchJob(ops, params('clamp-none'))
    expect(low.job.maxPages).toBe(1)
    expect(high.job.maxPages).toBe(100)
    expect(none.job.maxPages).toBe(5)
    for (const j of [low.job, high.job, none.job]) await authed(ops, 'POST', PATHS.ingestJobCancel(j.id))
  })

  it('参数不合法不入队：未知来源 / 非 30·90 天窗口 / 空请求体 → 400 SOURCE-INVALID', async () => {
    const before = Number((await authed(ops, 'GET', PATHS.ingestJobs)).json.total)
    const bad = [
      { source: 'weibo', window: 30 },
      { source: SOURCE, window: 60 },
      { source: SOURCE },
      {},
    ]
    for (const body of bad) {
      const res = await authed(ops, 'POST', PATHS.ingestFetch, body)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect(errorCode(res.json)).toBe(ERROR.SOURCE_INVALID)
    }
    const after = Number((await authed(ops, 'GET', PATHS.ingestJobs)).json.total)
    expect(after).toBe(before)
  })

  it('同步模式 ?sync=1 当场跑完并返回 201 与结果，不留在队列里等 worker', async () => {
    const { status, job } = await fetchJob(ops, params('sync', { maxPages: 1 }), true)
    expect(status).toBe(201)
    expect(job.status).toBe('ok')
    expect(job.pagesDone).toBe(1)
    expect(job.startedAt).not.toBeNull()
    expect(job.endedAt).not.toBeNull()
    expect(['live', 'fixture']).toContain(job.sourceMode)
    expect(job.writtenCount + job.skippedDupes + job.failedCount).toBeGreaterThan(0)
  })
})

describe('队列 — worker 自动处理', () => {
  it('入队后 worker 在一个轮询周期内接手并跑完：queued → ok，记录开始/结束时间、页数、去重', async () => {
    const { job } = await fetchJob(ops, params('auto', { maxPages: 1 }))
    const done = await waitFor(job.id, settled, WORKER_TICK_MS * 6)
    expect(done.status).toBe('ok')
    expect(done.pagesDone).toBe(1)
    expect(done.cursor).toBeNull()
    expect(done.error).toBeNull()
    expect(done.errorCode).toBeNull()
    expect(done.nextRunAt).toBeNull()
    expect(ms(done.startedAt)).toBeGreaterThanOrEqual(ms(done.createdAt) - 1_000)
    expect(ms(done.endedAt)).toBeGreaterThanOrEqual(ms(done.startedAt))
    expect(done.writtenCount + done.skippedDupes).toBeGreaterThan(0)
  })

  it('跑完的任务能在「样例」里看到本次写入的博主，原始返回原样可查', async () => {
    const { job } = await fetchJob(ops, params('sample', { maxPages: 1 }), true)
    const sample = await authed(ops, 'GET', PATHS.ingestSample(job.id))
    expect(sample.status).toBe(200)
    const items = sample.json.items as Array<{ id: string; displayName: string; needsReview: boolean }>
    expect(items.length).toBe(job.writtenCount + job.skippedDupes)
    for (const item of items) {
      expect(item.needsReview).toBe(true)
      expect(typeof item.displayName).toBe('string')
    }

    const raw = await authed(ops, 'GET', PATHS.ingestRaw(items[0].id))
    expect(raw.status).toBe(200)
    expect(raw.json.source).toBe(SOURCE)
    expect(raw.json.payload).toBeTypeOf('object')
    expect(String(raw.json.fetchedAt)).not.toBe('')

    const history = await sqlRead<{ n: string }>(
      'SELECT count(*) AS n FROM creator_metrics_history WHERE job_id = $1',
      [job.id],
    )
    expect(Number(history[0].n)).toBe(job.writtenCount + job.skippedDupes)
  })

  it('同一批博主再抓一次：全部算「已有」而不是新写入，历史快照照样多一份', async () => {
    const body = params('dupes', { maxPages: 1 })
    const first = await fetchJob(ops, body, true)
    const again = await fetchJob(ops, body, true)
    expect(again.job.writtenCount).toBe(0)
    expect(again.job.skippedDupes).toBe(first.job.writtenCount + first.job.skippedDupes)
    const snapshots = await sqlRead<{ n: string }>(
      'SELECT count(*) AS n FROM creator_metrics_history WHERE job_id = ANY($1::text[])',
      [[first.job.id, again.job.id]],
    )
    expect(Number(snapshots[0].n)).toBe(2 * again.job.skippedDupes)
  })

  it('演示数据（无凭证）不消耗日配额：quotaUsed 为 0，当日用量不变', async (ctx) => {
    if (live) return ctx.skip()
    const before = await todayUsage()
    const { job } = await fetchJob(ops, params('fixture-quota', { maxPages: 1 }), true)
    expect(job.sourceMode).toBe('fixture')
    expect(job.quotaUsed).toBe(0)
    expect(await todayUsage()).toBe(before)
  })
})

describe('队列 — 多页翻页、配额与限速（需要替身供应商）', () => {
  it('多页任务逐页翻到 next_cursor 为空 → ok；每页调用供应商一次并各计 1 次额度', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-pages-3')
    const usageBefore = await todayUsage()
    const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 10 })
    const done = await waitFor(job.id, settled)
    expect(done.status).toBe('ok')
    expect(done.sourceMode).toBe('live')
    expect(done.pagesDone).toBe(3)
    expect(done.cursor).toBeNull()
    expect(done.quotaUsed).toBe(3)
    expect(done.writtenCount).toBe(6)
    const calls = await vendorCalls(kw)
    expect(calls.map((c) => c.cursor)).toEqual([null, '2', '3'])
    expect(await todayUsage()).toBe(usageBefore + 3)
  }, 40_000)

  it('到达目标页数就停：maxPages=2 的任务翻两页后 ok，并保留下一页游标', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-pages-5-cap2')
    const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 2 })
    const done = await waitFor(job.id, settled)
    expect(done.status).toBe('ok')
    expect(done.pagesDone).toBe(2)
    expect(done.cursor).toBe('3')
    expect((await vendorCalls(kw)).length).toBe(2)
  }, 40_000)

  it('供应商 token 原样带过去：替身校验 Bearer，收不到就 401，任务不会成功', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('auth-ok')
    const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 1 }, true)
    expect(job.status).toBe('ok')
    const calls = await vendorCalls(kw)
    expect(calls.every((c) => c.status === 200)).toBe(true)
  })

  it('日配额用完 → partial：保留游标、记录 QUOTA_EXHAUSTED、续跑时间落在来源时区（北京）的次日 00:00', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-pages-4-quota')
    const used = await todayUsage()
    await setSource({ quota: used + 2 })
    try {
      const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 10 })
      const stopped = await waitFor(job.id, settled)
      expect(stopped.status).toBe('partial')
      expect(stopped.pagesDone).toBe(2)
      expect(stopped.cursor).toBe('3')
      expect(stopped.quotaUsed).toBe(2)
      expect(stopped.error).toBe('quota_exhausted')
      expect(stopped.errorCode).toBe('QUOTA_EXHAUSTED')
      expect(stopped.endedAt).not.toBeNull()
      const next = new Date(stopped.nextRunAt!)
      // Beijing midnight = 16:00 UTC.
      expect(next.getUTCHours()).toBe(16)
      expect(next.getUTCMinutes()).toBe(0)
      expect(next.getTime()).toBeGreaterThan(Date.now())
      expect(next.getTime() - Date.now()).toBeLessThanOrEqual(24 * 3_600_000)
      // Only the two paid pages were requested; the wall was hit before a third call left the building.
      expect((await vendorCalls(kw)).length).toBe(2)
      expect(await todayUsage()).toBe(used + 2)

      // 次日到点：worker 自己从第 3 页续跑，不需要人点重试。
      await setSource({ quota: 100_000 })
      await sqlExec("UPDATE ingest_jobs SET next_run_at = now() WHERE id = $1 AND status = 'partial'", [job.id])
      const resumed = await waitFor(job.id, (j) => j.status !== 'partial' && settled(j))
      expect(resumed.status).toBe('ok')
      expect(resumed.pagesDone).toBe(4)
      expect(resumed.cursor).toBeNull()
      expect(resumed.quotaUsed).toBe(4)
      expect(resumed.writtenCount).toBe(8)
      expect(resumed.error).toBeNull()
      expect((await vendorCalls(kw)).map((c) => c.cursor)).toEqual([null, '2', '3', '4'])
    } finally {
      await setSource({ quota: 100_000 })
    }
  }, 60_000)

  it('配额停下的任务可以立刻重试：回到队列、attempts 归零、从保留的游标继续而不是从头', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-pages-3-retry')
    const used = await todayUsage()
    await setSource({ quota: used + 1 })
    try {
      const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 10 })
      const stopped = await waitFor(job.id, settled)
      expect(stopped.status).toBe('partial')
      expect(stopped.cursor).toBe('2')

      await setSource({ quota: 100_000 })
      const retry = await authed(devops, 'POST', PATHS.ingestRetry(job.id))
      expect(retry.status).toBe(200)
      expect(retry.json).toMatchObject({ status: 'queued', attempts: 0, error: null, errorCode: null, cursor: '2', pagesDone: 1 })

      const done = await waitFor(job.id, settled)
      expect(done.status).toBe('ok')
      expect(done.pagesDone).toBe(3)
      expect(done.writtenCount).toBe(6)
      expect((await vendorCalls(kw)).map((c) => c.cursor)).toEqual([null, '2', '3'])
    } finally {
      await setSource({ quota: 100_000 })
    }
  }, 60_000)

  it('配额为 0 的来源相当于暂停：任务立刻 partial，一页都不抓，也不打供应商', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('paused')
    await setSource({ quota: 0 })
    try {
      const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 2 })
      const stopped = await waitFor(job.id, settled)
      expect(stopped.status).toBe('partial')
      expect(stopped.pagesDone).toBe(0)
      expect(stopped.quotaUsed).toBe(0)
      expect(stopped.errorCode).toBe('QUOTA_EXHAUSTED')
      expect((await vendorCalls(kw)).length).toBe(0)
    } finally {
      await setSource({ quota: 100_000 })
    }
  }, 40_000)

  it('同一来源同时只跑一个任务，先来先跑：两个任务的执行时间段不重叠且按提交顺序', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const a = await fetchJob(ops, { source: SOURCE, window: 30, keyword: keyword('bb-slow-600-a'), maxPages: 2 })
    const b = await fetchJob(ops, { source: SOURCE, window: 30, keyword: keyword('bb-slow-600-b'), maxPages: 2 })
    const [da, db] = await Promise.all([waitFor(a.job.id, settled, 40_000), waitFor(b.job.id, settled, 40_000)])
    expect(da.status).toBe('ok')
    expect(db.status).toBe('ok')
    expect(ms(db.startedAt)).toBeGreaterThanOrEqual(ms(da.endedAt))
    expect(ms(da.startedAt)).toBeLessThanOrEqual(ms(db.startedAt))
  }, 60_000)

  it('每分钟次数限制生效：额度 6 次/分时第 7 次调用要等约 10 秒', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    // 6/min → a fresh bucket holds 6 tokens and refills one every 10 s.
    await setSource({ rateLimit: 6 })
    try {
      const kw = keyword('bb-pages-7-rate')
      const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 7 })
      const done = await waitFor(job.id, settled, 60_000)
      expect(done.status).toBe('ok')
      expect(done.pagesDone).toBe(7)
      const calls = await vendorCalls(kw)
      expect(calls.length).toBe(7)
      const burst = calls[5].at - calls[0].at
      const throttled = calls[6].at - calls[5].at
      expect(burst).toBeLessThan(5_000)
      expect(throttled).toBeGreaterThanOrEqual(8_000)
      expect(throttled).toBeLessThan(20_000)
    } finally {
      await setSource({ rateLimit: 600 })
    }
  }, 90_000)
})

describe('队列 — 失败、退避与取消（需要替身供应商）', () => {
  it('供应商持续报错：退避重试 3 次后 failed，记录 SOURCE_UNAVAILABLE 与结束时间，续跑时间清空', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-fail')
    const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 1 })
    // First strike: back on the queue with a short wait, not failed yet.
    const struck = await waitFor(job.id, (j) => j.attempts >= 1, 15_000, 200)
    expect(struck.attempts).toBeGreaterThanOrEqual(1)
    if (struck.attempts < 3) {
      expect(struck.status).toBe('queued')
      expect(struck.errorCode).toBe('SOURCE_UNAVAILABLE')
      expect(struck.endedAt).toBeNull()
      expect(ms(struck.nextRunAt)).toBeGreaterThan(Date.now() - 5_000)
    }
    const dead = await waitFor(job.id, (j) => j.status === 'failed', 40_000)
    expect(dead.attempts).toBe(3)
    expect(dead.errorCode).toBe('SOURCE_UNAVAILABLE')
    expect(dead.endedAt).not.toBeNull()
    expect(dead.nextRunAt).toBeNull()
    expect(dead.pagesDone).toBe(0)
    expect(String(dead.errorSummary)).not.toMatch(/token|password|secret/i)
    expect((await vendorCalls(kw)).length).toBe(3)

    // 运维端「失败」列表与任务详情看到同一条。
    const failures = await authed(devops, 'GET', PATHS.devFailures)
    expect((failures.json.items as Job[]).some((j) => j.id === job.id)).toBe(true)
    const devView = await authed(devops, 'GET', PATHS.devJob(job.id))
    expect(devView.status).toBe(200)
    expect(devView.json.status).toBe('failed')
  }, 60_000)

  it('退避带随机抖动：第 1 次失败后 0–2 秒内再试，第 2 次 0–4 秒（再加 2 秒轮询）', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-fail-backoff')
    const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 1 })
    await waitFor(job.id, (j) => j.status === 'failed', 40_000)
    const calls = await vendorCalls(kw)
    expect(calls.length).toBe(3)
    const gap1 = calls[1].at - calls[0].at
    const gap2 = calls[2].at - calls[1].at
    // Full jitter: uniform in [0, 2 s) then [0, 4 s), observed through a 2 s worker tick.
    expect(gap1).toBeLessThan(4_800)
    expect(gap2).toBeLessThan(6_800)
  }, 60_000)

  it('供应商回 429 带 Retry-After：至少等它说的秒数再试，然后成功', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-429-6')
    const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 1 })
    const done = await waitFor(job.id, settled, 30_000)
    expect(done.status).toBe('ok')
    expect(done.attempts).toBe(1)
    const calls = await vendorCalls(kw)
    expect(calls.map((c) => c.status)).toEqual([429, 200])
    // Retry-After 6 s is a floor over the ≤2 s jitter; plus one 2 s tick at most.
    expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(5_800)
    expect(calls[1].at - calls[0].at).toBeLessThan(9_000)
  }, 60_000)

  it('供应商抖一下就恢复：第一次失败后自动重试成功 → ok，attempts 记 1，错误字段清空', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-flaky-1')
    const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 1 })
    const done = await waitFor(job.id, settled, 30_000)
    expect(done.status).toBe('ok')
    expect(done.attempts).toBe(1)
    expect(done.pagesDone).toBe(1)
    expect(done.error).toBeNull()
    expect(done.errorCode).toBeNull()
    expect(done.nextRunAt).toBeNull()
    expect((await vendorCalls(kw)).map((c) => c.status)).toEqual([500, 200])
  }, 60_000)

  it('failed 的任务重试后 attempts 归零重新入队；三次仍失败再次 failed', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-fail-again')
    const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 1 })
    await waitFor(job.id, (j) => j.status === 'failed', 40_000)
    const retry = await authed(devops, 'POST', PATHS.ingestRetry(job.id))
    expect(retry.status).toBe(200)
    expect(retry.json).toMatchObject({ status: 'queued', attempts: 0, error: null, errorCode: null, endedAt: null })
    const dead = await waitFor(job.id, (j) => j.status === 'failed', 40_000)
    expect(dead.attempts).toBe(3)
    expect((await vendorCalls(kw)).length).toBe(6)
  }, 90_000)

  it('正在翻页的任务可以取消：worker 在页边界停下，不再打供应商，状态定格为 failed/cancelled', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-slow-1500')
    const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 4 })
    const running = await waitFor(job.id, (j) => j.status === 'running', 15_000, 150)
    expect(running.startedAt).not.toBeNull()

    const cancel = await authed(ops, 'POST', PATHS.ingestJobCancel(job.id))
    expect(cancel.status).toBe(200)
    expect(cancel.json).toMatchObject({ status: 'failed', error: 'cancelled', errorCode: 'CANCELLED' })

    // Give the in-flight page time to land, then the worker must have stopped.
    await new Promise((resolve) => setTimeout(resolve, 3_500))
    const after = await getJob(job.id)
    expect(after.status).toBe('failed')
    expect(after.error).toBe('cancelled')
    expect(after.pagesDone).toBeLessThan(4)
    const callsNow = (await vendorCalls(kw)).length
    expect(callsNow).toBeLessThanOrEqual(after.pagesDone + 1)
    await new Promise((resolve) => setTimeout(resolve, WORKER_TICK_MS + 500))
    expect((await vendorCalls(kw)).length).toBe(callsNow)
    expect((await getJob(job.id)).status).toBe('failed')
  }, 40_000)

  it('取消后的任务保留已抓页数和游标，重试从断点续跑', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-slow-1200-resume')
    const { job } = await fetchJob(ops, { source: SOURCE, window: 30, keyword: kw, maxPages: 4 })
    await waitFor(job.id, (j) => j.status === 'running', 15_000, 150)
    await authed(ops, 'POST', PATHS.ingestJobCancel(job.id))
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    const stopped = await getJob(job.id)
    const pagesBefore = stopped.pagesDone
    const callsBefore = (await vendorCalls(kw)).length

    const retry = await authed(devops, 'POST', PATHS.ingestRetry(job.id))
    expect(retry.status).toBe(200)
    const done = await waitFor(job.id, settled, 40_000)
    expect(done.status).toBe('ok')
    expect(done.pagesDone).toBe(4)
    expect(done.cursor).toBeNull()
    expect((await vendorCalls(kw)).length).toBe(callsBefore + (4 - pagesBefore))
  }, 60_000)
})

describe('队列 — 生命周期约束（不依赖供应商）', () => {
  it('queued 可取消 → failed/cancelled，worker 之后不会再碰它', async () => {
    const { job } = await fetchJob(ops, params('cancel-queued', { maxPages: 1 }))
    const cancel = await authed(ops, 'POST', PATHS.ingestJobCancel(job.id))
    if (cancel.status === 409) return // the worker won the race; the next case covers that branch
    expect(cancel.status).toBe(200)
    expect(cancel.json).toMatchObject({ status: 'failed', error: 'cancelled', errorCode: 'CANCELLED', pagesDone: 0 })
    expect(cancel.json.endedAt).not.toBeNull()
    await new Promise((resolve) => setTimeout(resolve, WORKER_TICK_MS + 800))
    const after = await getJob(job.id)
    expect(after.status).toBe('failed')
    expect(after.pagesDone).toBe(0)
    expect(after.startedAt).toBeNull()
  })

  it('已结束（ok）的任务不能取消 → 409 JOB-STATE；不能重试 → 409 JOB-STATE', async () => {
    const { job } = await fetchJob(ops, params('done', { maxPages: 1 }), true)
    expect(job.status).toBe('ok')
    const cancel = await authed(ops, 'POST', PATHS.ingestJobCancel(job.id))
    expect(cancel.status).toBe(409)
    expect(errorCode(cancel.json)).toBe('JOB-STATE')
    const retry = await authed(devops, 'POST', PATHS.ingestRetry(job.id))
    expect(retry.status).toBe(409)
    expect(errorCode(retry.json)).toBe('JOB-STATE')
    expect((await getJob(job.id)).status).toBe('ok')
  })

  it('取消两次：第二次 409，记录不变', async () => {
    const { job } = await fetchJob(ops, params('cancel-twice', { maxPages: 1 }))
    const first = await authed(ops, 'POST', PATHS.ingestJobCancel(job.id))
    if (first.status !== 200) return
    const second = await authed(ops, 'POST', PATHS.ingestJobCancel(job.id))
    expect(second.status).toBe(409)
    expect(errorCode(second.json)).toBe('JOB-STATE')
    expect((await getJob(job.id)).endedAt).toBe(first.json.endedAt)
  })

  it('不存在的任务：详情 / 重试 / 取消 / 样例 都是 404 或空，不泄露别的任务', async () => {
    const ghost = '00000000-0000-4000-8000-000000000000'
    for (const [method, path] of [
      ['GET', PATHS.ingestJob(ghost)],
      ['POST', PATHS.ingestRetry(ghost)],
      ['POST', PATHS.ingestJobCancel(ghost)],
      ['GET', PATHS.devJob(ghost)],
      ['POST', PATHS.devRetry(ghost)],
    ] as const) {
      const res = await authed(admin, method, path)
      expect(res.status, `${method} ${path}`).toBe(404)
      expect(errorCode(res.json)).toBe(ERROR.NOT_FOUND)
    }
    const sample = await authed(ops, 'GET', `${PATHS.ingestJob(ghost)}/sample`)
    expect(sample.status).toBe(200)
    expect(sample.json.items).toEqual([])
  })

  it('两条通道看同一条记录：运营端 /api/ingest/jobs/:id 与运维端 /api/dev/jobs/:id 字段一致', async () => {
    const { job } = await fetchJob(ops, params('two-views', { maxPages: 1 }), true)
    const opsView = await getJob(job.id, ops)
    const devView = await authed(devops, 'GET', PATHS.devJob(job.id))
    expect(devView.status).toBe(200)
    for (const key of ['status', 'pagesDone', 'quotaUsed', 'writtenCount', 'attempts', 'sourceMode', 'createdAt', 'endedAt'] as const) {
      expect(devView.json[key], key).toEqual(opsView[key])
    }
  })
})

describe('队列 — 谁能做什么', () => {
  it('提交抓取只有运营/管理员可以；运维、选人、只读都是 403 AUTH-DENIED，且不会入队', async () => {
    const before = Number((await authed(ops, 'GET', PATHS.ingestJobs)).json.total)
    for (const session of [devops, selector, viewer]) {
      const res = await authed(session, 'POST', PATHS.ingestFetch, params('perm', { maxPages: 1 }))
      expect(res.status, session.role).toBe(403)
      expect(errorCode(res.json)).toBe(ERROR.DENIED)
    }
    const after = Number((await authed(ops, 'GET', PATHS.ingestJobs)).json.total)
    expect(after).toBe(before)
    const asAdmin = await fetchJob(admin, params('perm-admin', { maxPages: 1 }))
    expect(asAdmin.status).toBe(202)
  })

  it('取消归运营（ingest.write）：运维 403；重试归运维（ingest.retry）：运营 403', async () => {
    const { job } = await fetchJob(ops, params('perm-cancel', { maxPages: 1 }))
    const devCancel = await authed(devops, 'POST', PATHS.ingestJobCancel(job.id))
    expect(devCancel.status).toBe(403)
    expect(errorCode(devCancel.json)).toBe(ERROR.DENIED)
    await authed(ops, 'POST', PATHS.ingestJobCancel(job.id))
    await waitFor(job.id, (j) => j.status === 'failed' || j.status === 'ok', 15_000)

    const opsRetry = await authed(ops, 'POST', PATHS.ingestRetry(job.id))
    expect(opsRetry.status).toBe(403)
    expect(errorCode(opsRetry.json)).toBe(ERROR.DENIED)
    const opsDevRetry = await authed(ops, 'POST', PATHS.devRetry(job.id))
    expect(opsDevRetry.status).toBe(403)

    for (const session of [selector, viewer]) {
      expect((await authed(session, 'POST', PATHS.ingestJobCancel(job.id))).status).toBe(403)
      expect((await authed(session, 'POST', PATHS.ingestRetry(job.id))).status).toBe(403)
      expect((await authed(session, 'GET', PATHS.ingestJob(job.id))).status).toBe(403)
      expect((await authed(session, 'GET', PATHS.ingestJobs)).status).toBe(403)
    }
  })

  it('任务列表对运营和运维都可见，且内容一致', async () => {
    const a = await authed(ops, 'GET', PATHS.ingestJobs)
    const b = await authed(devops, 'GET', PATHS.ingestJobs)
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect((a.json.items as Job[]).map((j) => j.id)).toEqual((b.json.items as Job[]).map((j) => j.id))
  })

  it('重试 / 取消都留下审计足迹：操作人、动作、任务 ID', async () => {
    const { job } = await fetchJob(ops, params('audit', { maxPages: 1 }))
    const cancel = await authed(ops, 'POST', PATHS.ingestJobCancel(job.id))
    if (cancel.status !== 200) return
    const retry = await authed(devops, 'POST', PATHS.ingestRetry(job.id))
    expect(retry.status).toBe(200)
    const audit = await authed(devops, 'GET', PATHS.devAudit)
    expect(audit.status).toBe(200)
    const rows = (audit.json.items as Array<Record<string, unknown>>).filter((r) => r.entityId === job.id)
    const actions = rows.map((r) => String(r.action))
    expect(actions).toContain('ingest.cancel')
    expect(actions).toContain('ingest.retry')
  })
})
