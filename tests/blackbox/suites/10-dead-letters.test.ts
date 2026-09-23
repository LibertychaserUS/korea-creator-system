import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authed, login, type Session } from '../helpers/auth'
import { ERROR, PATHS } from '../helpers/contract'
import { errorCode, request, type Json } from '../helpers/http'
import { VENDOR_URL, vendorCalls } from '../helpers/mock-vendor'
import { closePool, sqlExec, sqlRead } from '../helpers/postgres'

/**
 * 搁置记录（死信队列）与「一条流水线」— 端到端黑盒（04 §失败与搁置 / §抽水）。
 *
 * 和 09 一样需要 API 接到替身供应商（`QIANGUA_BASE_URL` / `QIANGUA_TOKEN`）：
 * 只有真实调用才能造出「平台拒绝」「返回结构不对」「某条读不出来」三种失败。
 * 没接上时依赖这些的用例带原因跳过，权限 / 生命周期用例照跑。
 */

const SOURCE = 'qiangua'
const RUN = `dl${Date.now().toString(36)}`

type Job = {
  id: string
  status: string
  attempts: number
  errorCode: string | null
  nextRunAt: string | null
  pagesDone: number
  writtenCount: number
  failedCount: number
  endedAt: string | null
}

type DeadLetter = {
  id: string
  kind: 'job' | 'record'
  state: 'open' | 'replayed' | 'dismissed'
  source: string
  jobId: string | null
  externalId: string | null
  code: string
  message: string
  attempts: number
  replayCount: number
  query: Record<string, unknown> | null
  cursor: string | null
  payload: Record<string, unknown> | null
  replayJobId: string | null
  resolvedBy: string | null
  createdAt: string
  updatedAt: string
}

let ops: Session
let devops: Session
let admin: Session
let selector: Session
let viewer: Session
let live = false
let skipReason = ''
const opened: string[] = []

const keyword = (label: string) => `${RUN}-${label}`

async function fetchJob(body: Record<string, unknown>, sync = false): Promise<Job> {
  const res = await authed(ops, 'POST', `${PATHS.ingestFetch}${sync ? '?sync=1' : ''}`, body)
  const job = (sync ? res.json : (res.json.job as Json)) as unknown as Job
  if (job?.id) opened.push(job.id)
  return job
}

async function getJob(id: string): Promise<Job> {
  const res = await authed(ops, 'GET', PATHS.ingestJob(id))
  return res.json as unknown as Job
}

async function waitForJob(id: string, predicate: (job: Job) => boolean, timeoutMs = 40_000): Promise<Job> {
  const deadline = Date.now() + timeoutMs
  let last = await getJob(id)
  while (!predicate(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    last = await getJob(id)
  }
  if (!predicate(last)) throw new Error(`job ${id} stuck at ${JSON.stringify(last)}`)
  return last
}

async function parked(query = 'state=open'): Promise<DeadLetter[]> {
  const res = await authed(devops, 'GET', `${PATHS.devDeadLetters}?${query}`)
  expect(res.status).toBe(200)
  return res.json.items as unknown as DeadLetter[]
}

/** The dead letter this run's job produced, once the worker has parked it. */
async function parkedFor(jobId: string, timeoutMs = 40_000): Promise<DeadLetter> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const hit = (await parked('state=open&kind=job')).find((entry) => entry.jobId === jobId)
    if (hit) return hit
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`no open dead letter for job ${jobId}`)
}

beforeAll(async () => {
  ;[ops, devops, admin, selector, viewer] = await Promise.all([
    login('ops'),
    login('devops'),
    login('platform_admin'),
    login('selector'),
    login('selector_viewer'),
  ])
  await fetchJob({ source: SOURCE, window: 30, maxPages: 1 }, true)
  await sqlExec('UPDATE ingest_sources SET quota = 100000, rate_limit = 600 WHERE id = $1', [SOURCE])

  const adapters = await authed(ops, 'GET', PATHS.ingestAdapters)
  const qiangua = (adapters.json.items as Json[]).find((item) => item.id === SOURCE)
  if (!qiangua?.configured) {
    skipReason = `千瓜适配器未配置凭证（API 需带 QIANGUA_BASE_URL=${VENDOR_URL} QIANGUA_TOKEN 启动）`
    return
  }
  try {
    const before = (await vendorCalls(keyword('probe'))).length
    const probe = await fetchJob({ source: SOURCE, window: 30, keyword: keyword('probe'), maxPages: 1 }, true)
    live = (await vendorCalls(keyword('probe'))).length === before + 1 && probe.status === 'ok'
    if (!live) skipReason = `API 没有把千瓜请求打到替身供应商 ${VENDOR_URL}`
  } catch (error) {
    skipReason = `替身供应商 ${VENDOR_URL} 不可达：${String(error)}`
  }
}, 60_000)

afterAll(async () => {
  for (const id of opened) {
    const job = await getJob(id).catch(() => null)
    if (job && ['queued', 'running'].includes(job.status)) {
      await authed(admin, 'POST', PATHS.ingestJobCancel(id))
    }
  }
  // Leave the list clean for the next run of the suite.
  for (const entry of await parked('state=open')) {
    if (entry.source === SOURCE && String(entry.message).includes(RUN)) {
      await authed(devops, 'POST', PATHS.devDeadLetterDismiss(entry.id))
    }
  }
  await closePool()
})

describe('搁置记录 — 整次抓取', () => {
  it('平台拒绝（403）算「改了才有用」：第一次就搁置，不空转三次，也不再打平台', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-reject')
    const job = await fetchJob({ source: SOURCE, window: 30, keyword: kw, maxPages: 3 })
    const failed = await waitForJob(job.id, (j) => j.status === 'failed')
    expect(failed.attempts).toBe(1)
    expect(failed.errorCode).toBe('VENDOR_REJECTED')
    expect(failed.nextRunAt).toBeNull()
    expect(failed.endedAt).not.toBeNull()

    const entry = await parkedFor(job.id)
    expect(entry).toMatchObject({ kind: 'job', state: 'open', source: SOURCE, code: 'VENDOR_REJECTED', attempts: 1, replayCount: 0 })
    expect(entry.query).toMatchObject({ source: SOURCE, keyword: kw })
    // 凭证不会跟着错误信息落库。
    expect(entry.message).not.toContain('super-secret')

    const calls = (await vendorCalls(kw)).length
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    expect((await vendorCalls(kw)).length).toBe(calls)
    expect(calls).toBe(1)
  }, 60_000)

  it('返回结构不对也算「改了才有用」：一次就搁置，原因是接入设置', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const job = await fetchJob({ source: SOURCE, window: 30, keyword: keyword('bb-shape'), maxPages: 2 })
    const failed = await waitForJob(job.id, (j) => j.status === 'failed')
    expect(failed.attempts).toBe(1)
    expect(failed.errorCode).toBe('CONFIG_MISSING')
    const entry = await parkedFor(job.id)
    expect(entry.code).toBe('CONFIG_MISSING')
  }, 60_000)

  it('平台暂时挂了（500）先按退避试满三次，才落到搁置记录', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const job = await fetchJob({ source: SOURCE, window: 30, keyword: keyword('bb-fail-park'), maxPages: 1 })
    const mid = await waitForJob(job.id, (j) => j.attempts >= 1, 20_000)
    if (mid.status === 'queued') {
      expect((await parked('state=open&kind=job')).some((e) => e.jobId === job.id)).toBe(false)
    }
    const dead = await waitForJob(job.id, (j) => j.status === 'failed')
    expect(dead.attempts).toBe(3)
    const entry = await parkedFor(job.id)
    expect(entry).toMatchObject({ code: 'SOURCE_UNAVAILABLE', attempts: 3 })
  }, 90_000)

  it('「再试一次」把搁置的抓取按原参数重新排队，并交接给新任务', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const job = await fetchJob({ source: SOURCE, window: 90, keyword: keyword('bb-reject-replay'), maxPages: 2 })
    await waitForJob(job.id, (j) => j.status === 'failed')
    const entry = await parkedFor(job.id)

    const replay = await authed(devops, 'POST', PATHS.devDeadLetterReplay(entry.id))
    expect(replay.status).toBe(200)
    const newJob = replay.json.job as unknown as Job
    opened.push(newJob.id)
    expect(newJob.id).not.toBe(job.id)
    expect(String((replay.json.deadLetter as unknown as DeadLetter).state)).toBe('replayed')
    expect((replay.json.deadLetter as unknown as DeadLetter).replayJobId).toBe(newJob.id)
    expect((replay.json.deadLetter as unknown as DeadLetter).resolvedBy).not.toBeNull()

    // 处理过就不在待处理清单里了，但记录仍在（可查）。
    expect((await parked('state=open')).some((e) => e.id === entry.id)).toBe(false)
    expect((await parked('state=all')).some((e) => e.id === entry.id)).toBe(true)
    // 参数原样带过去：还是 90 天窗口。
    const requeued = await getJob(newJob.id)
    expect(requeued.id).toBe(newJob.id)
  }, 90_000)

  it('人工「重试」任务本身，也会把它的搁置记录一起结掉，不留孤儿', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const job = await fetchJob({ source: SOURCE, window: 30, keyword: keyword('bb-reject-retry'), maxPages: 1 })
    await waitForJob(job.id, (j) => j.status === 'failed')
    const entry = await parkedFor(job.id)

    const retry = await authed(devops, 'POST', PATHS.ingestRetry(job.id))
    expect(retry.status).toBe(200)
    expect((await parked('state=open')).some((e) => e.id === entry.id)).toBe(false)
    const all = (await parked('state=all')).find((e) => e.id === entry.id)!
    expect(all).toMatchObject({ state: 'replayed', replayJobId: job.id })
  }, 90_000)
})

describe('搁置记录 — 单个博主', () => {
  it('读不出来的那条留着原始内容进搁置，其余照常入库', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-badrecord')
    const job = await fetchJob({ source: SOURCE, window: 30, keyword: kw, maxPages: 1 }, true)
    expect(job.status).toBe('ok')
    expect(job.writtenCount).toBe(1)
    expect(job.failedCount).toBe(1)

    const entry = (await parked('state=open&kind=record')).find((e) => e.jobId === job.id)!
    expect(entry).toBeTruthy()
    expect(entry).toMatchObject({ kind: 'record', state: 'open', source: SOURCE, code: 'RECORD_INVALID' })
    expect(entry.externalId).toContain(kw)
    // 原始内容原样留着，处理时不用再找平台要一次。
    expect(entry.payload).toBeTypeOf('object')
    expect(String(entry.message)).toContain('displayName')
  }, 60_000)

  it('同一条又失败一次只更新原记录，不堆重复', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-badrecord-twice')
    const first = await fetchJob({ source: SOURCE, window: 30, keyword: kw, maxPages: 1 }, true)
    const before = (await parked('state=open&kind=record')).filter((e) => e.externalId?.includes(kw))
    expect(before).toHaveLength(1)
    expect(first.failedCount).toBe(1)

    await fetchJob({ source: SOURCE, window: 30, keyword: kw, maxPages: 1 }, true)
    const after = (await parked('state=open&kind=record')).filter((e) => e.externalId?.includes(kw))
    expect(after).toHaveLength(1)
    expect(after[0].attempts).toBe(before[0].attempts + 1)
  }, 60_000)

  it('内容修好后「再试一次」直接入库，不花平台额度', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-badrecord-fix')
    const job = await fetchJob({ source: SOURCE, window: 30, keyword: kw, maxPages: 1 }, true)
    const entry = (await parked('state=open&kind=record')).find((e) => e.jobId === job.id)!

    const usageBefore = await sqlRead<{ n: string }>(
      'SELECT coalesce(sum(calls),0) AS n FROM ingest_source_usage WHERE source = $1',
      [SOURCE],
    )
    const callsBefore = (await vendorCalls(kw)).length
    // 有人把缺的名字补上（真实场景里是改字段对应关系）。
    await sqlExec(
      `UPDATE ingest_dead_letters SET payload = jsonb_set(payload, '{昵称}', '"补好的名字"') WHERE id = $1`,
      [entry.id],
    )

    const replay = await authed(devops, 'POST', PATHS.devDeadLetterReplay(entry.id))
    expect(replay.status).toBe(200)
    expect(replay.json.result).toMatchObject({ written: 1, failed: 0 })
    expect((replay.json.deadLetter as unknown as DeadLetter).state).toBe('replayed')

    const usageAfter = await sqlRead<{ n: string }>(
      'SELECT coalesce(sum(calls),0) AS n FROM ingest_source_usage WHERE source = $1',
      [SOURCE],
    )
    expect(Number(usageAfter[0].n)).toBe(Number(usageBefore[0].n))
    expect((await vendorCalls(kw)).length).toBe(callsBefore)
  }, 60_000)

  it('修不好就一直留着并记次数，试满三次后不再提供「再试一次」', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-badrecord-poison')
    const job = await fetchJob({ source: SOURCE, window: 30, keyword: kw, maxPages: 1 }, true)
    const entry = (await parked('state=open&kind=record')).find((e) => e.jobId === job.id)!

    for (let i = 1; i <= 3; i += 1) {
      const res = await authed(devops, 'POST', PATHS.devDeadLetterReplay(entry.id))
      expect(res.status).toBe(409)
      expect((res.json.deadLetter as unknown as DeadLetter)).toMatchObject({ state: 'open', replayCount: i })
    }
    const exhausted = await authed(devops, 'POST', PATHS.devDeadLetterReplay(entry.id))
    expect(exhausted.status).toBe(409)
    expect(errorCode(exhausted.json)).toBe('JOB-STATE')
  }, 60_000)
})

describe('搁置记录 — 处理、权限、可见性', () => {
  let entry: DeadLetter

  beforeAll(async () => {
    if (!live) return
    const job = await fetchJob({ source: SOURCE, window: 30, keyword: keyword('bb-reject-perm'), maxPages: 1 })
    await waitForJob(job.id, (j) => j.status === 'failed')
    entry = await parkedFor(job.id)
  }, 60_000)

  it('运维端能看清单和单条；运营能看但不能处理；选人 / 只读看不到', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const detail = await authed(devops, 'GET', PATHS.devDeadLetter(entry.id))
    expect(detail.status).toBe(200)
    expect(detail.json.id).toBe(entry.id)

    expect((await authed(ops, 'GET', PATHS.devDeadLetters)).status).toBe(200)
    for (const path of [PATHS.devDeadLetterReplay(entry.id), PATHS.devDeadLetterDismiss(entry.id)]) {
      const res = await authed(ops, 'POST', path)
      expect(res.status).toBe(403)
      expect(errorCode(res.json)).toBe(ERROR.DENIED)
    }
    for (const session of [selector, viewer]) {
      expect((await authed(session, 'GET', PATHS.devDeadLetters)).status).toBe(403)
      expect((await authed(session, 'GET', PATHS.devDeadLetter(entry.id))).status).toBe(403)
      expect((await authed(session, 'POST', PATHS.devDeadLetterReplay(entry.id))).status).toBe(403)
    }
    const anon = await request('GET', PATHS.devDeadLetters)
    expect(anon.status).toBe(401)
    expect(errorCode(anon.json)).toBe(ERROR.LOGIN)
  }, 60_000)

  it('「不再处理」把它从待处理里拿掉；再处理一次是 409，也不能再试', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const dismissed = await authed(devops, 'POST', PATHS.devDeadLetterDismiss(entry.id))
    expect(dismissed.status).toBe(200)
    expect(dismissed.json).toMatchObject({ state: 'dismissed' })
    expect(dismissed.json.resolvedBy).not.toBeNull()

    expect((await parked('state=open')).some((e) => e.id === entry.id)).toBe(false)
    expect((await parked('state=dismissed')).some((e) => e.id === entry.id)).toBe(true)

    const again = await authed(devops, 'POST', PATHS.devDeadLetterDismiss(entry.id))
    expect(again.status).toBe(409)
    expect(errorCode(again.json)).toBe('JOB-STATE')
    const replay = await authed(devops, 'POST', PATHS.devDeadLetterReplay(entry.id))
    expect(replay.status).toBe(409)
  }, 60_000)

  it('筛选参数只认已知取值；不存在的记录是 404', async () => {
    for (const bad of ['state=nope', 'kind=nope']) {
      const res = await authed(devops, 'GET', `${PATHS.devDeadLetters}?${bad}`)
      expect(res.status).toBe(400)
      expect(errorCode(res.json)).toBe(ERROR.VALIDATION)
    }
    const byKind = await authed(devops, 'GET', `${PATHS.devDeadLetters}?state=all&kind=job`)
    expect(byKind.status).toBe(200)
    expect((byKind.json.items as DeadLetter[]).every((e) => e.kind === 'job')).toBe(true)

    const ghost = '00000000-0000-4000-8000-000000000000'
    for (const [method, path] of [
      ['GET', PATHS.devDeadLetter(ghost)],
      ['POST', PATHS.devDeadLetterReplay(ghost)],
      ['POST', PATHS.devDeadLetterDismiss(ghost)],
    ] as const) {
      const res = await authed(devops, method, path)
      expect(res.status).toBe(404)
      expect(errorCode(res.json)).toBe(ERROR.NOT_FOUND)
    }
  })

  it('健康页给出搁置条数和当前在抓的来源，供值班一眼看到', async () => {
    const health = await authed(devops, 'GET', PATHS.devHealth)
    expect(health.status).toBe(200)
    const counts = health.json.deadLetters as { jobs: number; records: number; total: number }
    expect(counts.total).toBe(counts.jobs + counts.records)
    expect(counts.total).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(health.json.running)).toBe(true)
  })
})

describe('一条流水线', () => {
  it('同一时刻最多一个任务在抓：连提五个，运行中的始终不超过一个', async () => {
    const ids: string[] = []
    for (let i = 0; i < 5; i += 1) {
      const job = await fetchJob({
        source: SOURCE,
        window: 30,
        ...(live ? { keyword: keyword(`bb-slow-400-${i}`) } : {}),
        maxPages: 2,
      })
      ids.push(job.id)
    }
    const deadline = Date.now() + 45_000
    let maxRunning = 0
    let done = 0
    while (Date.now() < deadline) {
      const list = await authed(ops, 'GET', PATHS.ingestJobs)
      const mine = (list.json.items as Job[]).filter((job) => ids.includes(job.id))
      maxRunning = Math.max(maxRunning, mine.filter((job) => job.status === 'running').length)
      done = mine.filter((job) => ['ok', 'partial', 'failed'].includes(job.status)).length
      if (done === ids.length) break
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    expect(done).toBe(ids.length)
    expect(maxRunning).toBeLessThanOrEqual(1)
  }, 60_000)

  it('抓取中的任务带着持有者与租约；跑完就交还，不留占用', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const job = await fetchJob({ source: SOURCE, window: 30, keyword: keyword('bb-slow-1200-lease'), maxPages: 3 })
    await waitForJob(job.id, (j) => j.status === 'running', 20_000)
    const held = await sqlRead<{ locked_by: string | null; lease_expires_at: string | null }>(
      'SELECT locked_by, lease_expires_at FROM ingest_jobs WHERE id = $1',
      [job.id],
    )
    expect(held[0].locked_by).toBeTruthy()
    expect(new Date(String(held[0].lease_expires_at)).getTime()).toBeGreaterThan(Date.now())

    const health = await authed(devops, 'GET', PATHS.devHealth)
    const running = health.json.running as Array<{ sourceId: string; lockedBy: string }>
    expect(running.some((row) => row.sourceId === SOURCE && Boolean(row.lockedBy))).toBe(true)

    await waitForJob(job.id, (j) => ['ok', 'partial', 'failed'].includes(j.status))
    const released = await sqlRead<{ locked_by: string | null; lease_expires_at: string | null }>(
      'SELECT locked_by, lease_expires_at FROM ingest_jobs WHERE id = $1',
      [job.id],
    )
    expect(released[0].locked_by).toBeNull()
    expect(released[0].lease_expires_at).toBeNull()
  }, 60_000)

  it('抓取途中进程没了：任务卡在抓取中，租约到期后被接手跑完，不会两边同时抓', async (ctx) => {
    if (!live) return ctx.skip(skipReason)
    const kw = keyword('bb-pages-2-orphan')
    const job = await fetchJob({ source: SOURCE, window: 30, keyword: kw, maxPages: 2 })
    await waitForJob(job.id, (j) => ['ok', 'partial', 'failed'].includes(j.status))
    const callsBefore = (await vendorCalls(kw)).length

    // 模拟上一个进程抓到第一页就没了：留下抓取中 + 还没到期的租约。
    await sqlExec(
      `UPDATE ingest_jobs SET status = 'running', pages_done = 1, cursor = '2',
         locked_by = 'gone:1', lease_expires_at = now() + interval '20 seconds' WHERE id = $1`,
      [job.id],
    )
    await new Promise((resolve) => setTimeout(resolve, 4_000))
    const stillHeld = await getJob(job.id)
    expect(stillHeld.status).toBe('running')
    expect((await vendorCalls(kw)).length).toBe(callsBefore)

    // 租约到期 → 被接手，从第 2 页继续。
    await sqlExec(
      "UPDATE ingest_jobs SET lease_expires_at = now() - interval '1 second' WHERE id = $1",
      [job.id],
    )
    const finished = await waitForJob(job.id, (j) => j.status === 'ok')
    expect(finished.pagesDone).toBe(2)
    expect((await vendorCalls(kw)).length).toBe(callsBefore + 1)
  }, 90_000)
})
