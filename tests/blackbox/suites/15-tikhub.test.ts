import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authed, login, type Session } from '../helpers/auth'
import { PATHS } from '../helpers/contract'
import { type Json } from '../helpers/http'
import { TIKHUB_SECTIONS } from '../helpers/mock-tikhub'
import { VENDOR_URL, vendorCalls, type VendorCall } from '../helpers/mock-vendor'
import { closePool, sqlExec, sqlRead } from '../helpers/postgres'

/**
 * 蒲公英 via TikHub — 计费与失败分类，端到端黑盒（04 §按次计费、§失败）。
 *
 * API 以 `TIKHUB_API_KEY=blackbox-vendor-token TIKHUB_BASE_URL=http://127.0.0.1:7190
 * PGY_TIMEOUT_MS=1500` 启动（scripts/ci/blackbox-up.sh），蒲公英适配器打到 global-setup
 * 起的替身供应商的 TikHub 路由上，**不会发出任何真实 TikHub 调用**。没接上时整组跳过并说明原因。
 *
 * 来源的日配额、日预算、每分钟次数没有 HTTP 入口，这里用 SQL 拧；其余全部走 HTTP 断言。
 * 用量都按「前后差」比，不删任何历史行。
 */

const SOURCE = 'pugongying'
const RUN = `th${Date.now().toString(36)}`
const PRICE = 0.02

type Job = {
  id: string
  status: 'queued' | 'running' | 'ok' | 'partial' | 'failed'
  sourceMode: string | null
  pagesDone: number
  quotaUsed: number
  costUsd: number
  vendorRequests: number
  emptyCount: number
  writtenCount: number
  skippedDupes: number
  attempts: number
  cursor: string | null
  error: string | null
  errorCode: string | null
  nextRunAt: string | null
}

type SourceRow = {
  id: string
  pausedAt: string | null
  pausedCode: string | null
  callsToday: number
  costTodayUsd: number
  requestsToday: number
  maybeBilledToday: number
  emptyToday: number
  dailyBudgetUsd: number | null
  quota: number | null
}

let ops: Session
let devops: Session
let admin: Session
let live = false
let skipReason = ''
let saved: { quota: number | null; rate_limit: number | null; daily_budget_usd: string | null } | null = null
const enqueued: string[] = []

const keyword = (label: string) => `${RUN}-${label}`
const settled = (job: Job) => ['ok', 'partial', 'failed'].includes(job.status)

async function getJob(id: string): Promise<Job> {
  const res = await authed(ops, 'GET', PATHS.ingestJob(id))
  expect(res.status).toBe(200)
  return res.json as unknown as Job
}

async function waitFor(id: string, predicate: (job: Job) => boolean, timeoutMs = 25_000): Promise<Job> {
  const deadline = Date.now() + timeoutMs
  let last = await getJob(id)
  while (!predicate(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    last = await getJob(id)
  }
  if (!predicate(last)) throw new Error(`job ${id} did not reach expected state in ${timeoutMs}ms; last=${JSON.stringify(last)}`)
  return last
}

async function enqueue(body: Record<string, unknown>): Promise<Job> {
  const res = await authed(ops, 'POST', PATHS.ingestFetch, { source: SOURCE, window: 30, maxPages: 1, ...body })
  expect(res.status, JSON.stringify(res.json)).toBe(202)
  const job = res.json.job as unknown as Job
  enqueued.push(job.id)
  return job
}

async function search(label: string, extra: Record<string, unknown> = {}, timeoutMs?: number): Promise<Job> {
  const job = await enqueue({ keyword: keyword(label), ...extra })
  return waitFor(job.id, settled, timeoutMs)
}

async function source(): Promise<SourceRow> {
  const res = await authed(devops, 'GET', PATHS.devPipeline)
  expect(res.status).toBe(200)
  return (res.json.sources as unknown as SourceRow[]).find((row) => row.id === SOURCE)!
}

async function callsFor(prefix: string): Promise<VendorCall[]> {
  return (await vendorCalls()).filter((call) => call.path?.startsWith('/api/v1/') && call.keyword.startsWith(prefix))
}

async function setSource(patch: { quota?: number | null; budget?: number | null }) {
  if (patch.quota !== undefined) await sqlExec('UPDATE ingest_sources SET quota = $2 WHERE id = $1', [SOURCE, patch.quota])
  if (patch.budget !== undefined) await sqlExec('UPDATE ingest_sources SET daily_budget_usd = $2 WHERE id = $1', [SOURCE, patch.budget])
}

beforeAll(async () => {
  ;[ops, devops, admin] = await Promise.all([login('ops'), login('devops'), login('platform_admin')])
  const adapters = await authed(ops, 'GET', PATHS.ingestAdapters)
  const pgy = (adapters.json.items as Json[]).find((item) => item.id === SOURCE) as Json | undefined
  const access = pgy?.access as Json | undefined
  if (!pgy?.configured || access?.gateway !== 'tikhub') {
    skipReason = `蒲公英没有接 TikHub 替身（API 需带 TIKHUB_API_KEY、TIKHUB_BASE_URL=${VENDOR_URL} 启动；access=${JSON.stringify(access ?? null)}）`
    return
  }
  const rows = await sqlRead<{ quota: number | null; rate_limit: number | null; daily_budget_usd: string | null }>(
    'SELECT quota, rate_limit, daily_budget_usd FROM ingest_sources WHERE id = $1',
    [SOURCE],
  )
  saved = rows[0] ?? null
  await sqlExec(
    'UPDATE ingest_sources SET enabled = true, quota = 100000, rate_limit = 600, daily_budget_usd = 1000, paused_at = NULL, paused_code = NULL, paused_detail = NULL WHERE id = $1',
    [SOURCE],
  )
  try {
    const probe = await search('probe')
    const sent = await callsFor(keyword('probe'))
    live = probe.status === 'ok' && probe.sourceMode === 'live' && sent.length === 1
    if (!live) skipReason = `蒲公英请求没有打到替身供应商（status=${probe.status} sourceMode=${probe.sourceMode} calls=${sent.length}）`
  } catch (error) {
    skipReason = `替身供应商 ${VENDOR_URL} 不可达：${String(error)}`
  }
}, 60_000)

afterAll(async () => {
  for (const id of enqueued) {
    const job = await getJob(id).catch(() => null)
    if (job && ['queued', 'running'].includes(job.status)) await authed(admin, 'POST', PATHS.ingestJobCancel(id))
  }
  if (saved) {
    await sqlExec(
      'UPDATE ingest_sources SET quota = $2, rate_limit = $3, daily_budget_usd = $4, paused_at = NULL, paused_code = NULL, paused_detail = NULL WHERE id = $1',
      [SOURCE, saved.quota, saved.rate_limit, saved.daily_budget_usd],
    )
  }
  await closePool()
})

describe('TikHub — 计费', () => {
  it('搜索一页 = 1 次计费调用，$0.02；运维端「调用与额度」看到次数与金额', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const before = await source()
    const job = await search('ok')
    expect(job).toMatchObject({ status: 'ok', quotaUsed: 1, vendorRequests: 1, writtenCount: 2 })
    expect(job.costUsd).toBeCloseTo(PRICE, 6)
    const after = await source()
    expect(after.callsToday - before.callsToday).toBe(1)
    expect(after.costTodayUsd - before.costTodayUsd).toBeCloseTo(PRICE, 6)
  })

  it('按次预留：日配额还剩 7 次时，刷新 2 位博主（每人 6 次）正好停在第 7 次，partial QUOTA_EXHAUSTED', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const before = await source()
    await setSource({ quota: before.callsToday + 7 })
    try {
      const ids = [keyword('q1'), keyword('q2')]
      const job = await waitFor((await enqueue({ externalIds: ids })).id, settled)
      expect(job).toMatchObject({ status: 'partial', errorCode: 'QUOTA_EXHAUSTED', quotaUsed: 7 })
      expect(await callsFor(keyword('q'))).toHaveLength(7)
      expect((await source()).callsToday).toBe(before.callsToday + 7)
    } finally {
      await setSource({ quota: 100_000 })
    }
  })

  it('日预算：还剩 $0.10 时停在第 5 次（第一位博主的 6 次还差 1 次，partial BUDGET_EXHAUSTED），一次也不多发', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const before = await source()
    await setSource({ budget: Math.round((before.costTodayUsd + 5 * PRICE) * 10_000) / 10_000 })
    try {
      const ids = [keyword('b1'), keyword('b2')]
      const job = await waitFor((await enqueue({ externalIds: ids })).id, settled)
      expect(job).toMatchObject({ status: 'partial', errorCode: 'BUDGET_EXHAUSTED', quotaUsed: 5 })
      expect(await callsFor(keyword('b'))).toHaveLength(5)
      const after = await source()
      expect(after.costTodayUsd - before.costTodayUsd).toBeCloseTo(5 * PRICE, 6)
    } finally {
      await setSource({ budget: 1000 })
    }
  })

  it('200 但查无结果：照样计费并计数（任务 emptyCount、运维端 emptyToday）', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const before = await source()
    const job = await search('th-empty')
    expect(job).toMatchObject({ status: 'ok', quotaUsed: 1, emptyCount: 1, writtenCount: 0 })
    const after = await source()
    expect(after.emptyToday - before.emptyToday).toBe(1)
    expect(after.callsToday - before.callsToday).toBe(1)
  })
})

describe('TikHub — 口径（成本默认合作笔记、传播默认自然流量）', () => {
  it('按口径发请求：成本先问合作笔记，没有合作数据再问日常；传播问自然流量，另取一次含投放作对照；存下的口径与数一一对应', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const scope = await sqlRead<{ traffic_scope: string | null; business_scope: string | null }>(
      'SELECT traffic_scope, business_scope FROM ingest_sources WHERE id = $1',
      [SOURCE],
    )
    if (scope[0]?.traffic_scope || scope[0]?.business_scope) return ctx.skip('来源行上写了口径，不是默认值')
    const coop = keyword('basis')
    const nocoop = keyword('nocoop')
    const job = await waitFor((await enqueue({ externalIds: [coop, nocoop] })).id, settled)
    // 合作有数：详情 + 数据概览（合作）+ 粉丝 + 笔记表现（自然）+ 粉丝画像 + 笔记表现（含投放）= 6；没有合作数据的多问一次日常 = 7。
    expect(job).toMatchObject({ status: 'ok', writtenCount: 2, quotaUsed: 13 })

    const sent = async (id: string, endpoint: string) =>
      (await vendorCalls()).filter((call) => call.keyword === id && call.path?.endsWith(endpoint)).map((call) => call.params)
    expect(await sent(coop, 'get_blogger_data_summary')).toEqual([{ business: 1 }])
    expect(await sent(nocoop, 'get_blogger_data_summary')).toEqual([{ business: 1 }, { business: 0 }])
    for (const id of [coop, nocoop]) {
      expect(await sent(id, 'get_blogger_notes_rate')).toEqual([{ business: 0, advertiseSwitch: 0 }, { business: 0, advertiseSwitch: 1 }])
    }

    const stored = await sqlRead<{ external_id: string; metrics: Record<string, any> }>(
      `SELECT cs.external_id, c.metrics FROM creator_sources cs JOIN creators c ON c.id = cs.creator_id
        WHERE cs.source = $1 AND cs.external_id = ANY($2::text[])`,
      [SOURCE, [coop, nocoop]],
    )
    const by = Object.fromEntries(stored.map((row) => [row.external_id, row.metrics]))
    expect(by[coop]!.basis).toMatchObject({ trafficScope: 'organic', businessScope: 'coop' })
    expect(by[coop]!.basis.costFallback).toBeUndefined()
    expect(by[coop]!.cpe).toBe(TIKHUB_SECTIONS.coopCost.estimatePictureEngageCost)
    expect(by[nocoop]!.basis).toMatchObject({ trafficScope: 'organic', businessScope: 'daily', costFallback: 'noCoopData' })
    expect(by[nocoop]!.cpe).toBe(TIKHUB_SECTIONS.dailyCost.estimatePictureEngageCost)
    for (const id of [coop, nocoop]) {
      // 排位与排序用自然流量；含投放只作对照，另存一份。
      expect(by[id]!.readMedian).toBe(TIKHUB_SECTIONS.organic.readMedian)
      expect(by[id]!.allTraffic).toMatchObject({ readMedian: TIKHUB_SECTIONS.all.readMedian, impressionMedian: TIKHUB_SECTIONS.all.impMedian })
    }
  })
})

describe('TikHub — 失败分类', () => {
  it('402 余额不足：任务进搁置记录，来源暂停并提醒（首页 + 审计），恢复后重放能跑完', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const failed = await search('th-402once')
    expect(failed).toMatchObject({ status: 'failed', errorCode: 'BALANCE_EXHAUSTED', attempts: 1, quotaUsed: 0 })
    expect(failed.error).toMatch(/HTTP 402 \(request_id th-\d+\)/)

    const health = await authed(devops, 'GET', PATHS.devHealth)
    expect(health.json.pausedSources).toEqual(expect.arrayContaining([expect.objectContaining({ id: SOURCE, code: 'BALANCE_EXHAUSTED' })]))
    expect((await source()).pausedCode).toBe('BALANCE_EXHAUSTED')
    const trail = await sqlRead<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_logs WHERE action = 'source.paused' AND entity_id = $1 AND created_at > now() - interval '5 minutes'",
      [SOURCE],
    )
    expect(trail[0]!.n).toBeGreaterThanOrEqual(1)

    // Paused: nothing else of the source is sent.
    const waiting = await enqueue({ keyword: keyword('while-paused') })
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    expect((await getJob(waiting.id)).status).toBe('queued')
    expect(await callsFor(keyword('while-paused'))).toHaveLength(0)

    const parked = await sqlRead<{ id: string; state: string }>(
      "SELECT id, state FROM ingest_dead_letters WHERE job_id = $1 AND kind = 'job'",
      [failed.id],
    )
    expect(parked).toEqual([expect.objectContaining({ state: 'open' })])

    const resumed = await authed(devops, 'POST', PATHS.devSourceResume(SOURCE))
    expect(resumed.status).toBe(200)
    expect(resumed.json).toMatchObject({ id: SOURCE, resumed: true })
    expect(await waitFor(waiting.id, settled)).toMatchObject({ status: 'ok' })

    const replay = await authed(devops, 'POST', PATHS.devDeadLetterReplay(parked[0]!.id))
    expect(replay.status).toBe(200)
    const replayId = String((replay.json.job as Json).id)
    expect((replay.json.deadLetter as Json).replayJobId).toBe(replayId)
    enqueued.push(replayId)
    expect(await waitFor(replayId, settled)).toMatchObject({ status: 'ok', writtenCount: 2 })
  }, 60_000)

  it('401 凭证失效：第一次就停（CREDENTIAL_INVALID），不重试、不暂停来源', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const job = await search('th-401')
    expect(job).toMatchObject({ status: 'failed', errorCode: 'CREDENTIAL_INVALID', attempts: 1, quotaUsed: 0 })
    expect(await callsFor(keyword('th-401'))).toHaveLength(1)
    expect((await source()).pausedAt).toBeNull()
  })

  it('400：同一次调用里重发一次；仍 400 → VENDOR_REJECTED 永久；第二次成了就正常入库', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const rejected = await search('th-400')
    expect(rejected).toMatchObject({ status: 'failed', errorCode: 'VENDOR_REJECTED', attempts: 1, quotaUsed: 0 })
    expect((await callsFor(keyword('th-400'))).filter((c) => c.keyword === keyword('th-400'))).toHaveLength(2)

    const recovered = await search('th-400once')
    expect(recovered).toMatchObject({ status: 'ok', writtenCount: 2, quotaUsed: 1, vendorRequests: 2 })
    expect(await callsFor(keyword('th-400once'))).toHaveLength(2)
  })

  it('200 但内层 success=false：计费、不重试（VENDOR_INNER_ERROR），错误带 request_id', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const job = await search('th-inner')
    expect(job).toMatchObject({ status: 'failed', errorCode: 'VENDOR_INNER_ERROR', attempts: 1, quotaUsed: 1 })
    expect(job.error).toMatch(/inner error -1: 参数错误 \(request_id th-\d+\)/)
    expect(await callsFor(keyword('th-inner'))).toHaveLength(1)
  })

  it('429 带 Retry-After：不计费，至少等那么久再发，第二次成功', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const job = await search('th-429-1')
    expect(job).toMatchObject({ status: 'ok', quotaUsed: 1 })
    const sent = await callsFor(keyword('th-429-1'))
    expect(sent.map((c) => c.status)).toEqual([429, 200])
    expect(sent[1]!.at - sent[0]!.at).toBeGreaterThanOrEqual(1_000)
  })

  it('5xx：暂时性，退避重试到上限（SOURCE_UNAVAILABLE），一次都不计费', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const job = await search('th-500', {}, 40_000)
    expect(job).toMatchObject({ status: 'failed', errorCode: 'SOURCE_UNAVAILABLE', attempts: 3, quotaUsed: 0 })
    expect(await callsFor(keyword('th-500'))).toHaveLength(3)
  }, 60_000)

  it('超时（PGY_TIMEOUT_MS）：暂时性 VENDOR_TIMEOUT，错误写明可能已扣费，记一次「可能已扣费」', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const before = await source()
    const job = await enqueue({ keyword: keyword('th-slow-3000') })
    const first = await waitFor(job.id, (j) => j.errorCode === 'VENDOR_TIMEOUT' || settled(j))
    expect(first.errorCode).toBe('VENDOR_TIMEOUT')
    expect(first.error).toMatch(/may have been billed/)
    expect((await source()).maybeBilledToday - before.maybeBilledToday).toBeGreaterThanOrEqual(1)
    await authed(admin, 'POST', PATHS.ingestJobCancel(job.id))
  }, 40_000)
})

describe('TikHub — 余额', () => {
  it('免费账户接口查余额：运维端「调用与额度」显示余额，不计入调用次数', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const before = await source()
    const res = await authed(devops, 'POST', '/api/dev/vendor-balance/check')
    expect(res.status).toBe(200)
    const pipeline = await authed(devops, 'GET', PATHS.devPipeline)
    expect(pipeline.json.balance).toMatchObject({ vendor: 'tikhub', ok: true, balanceUsd: 42.5, low: false })
    expect((await source()).callsToday).toBe(before.callsToday)
  })
})
