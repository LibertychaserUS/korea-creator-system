import { beforeAll, describe, expect, it } from 'vitest'
import { authed, login, type Session } from '../helpers/auth'
import { PATHS } from '../helpers/contract'
import { createCreator, poolItems, publishCreator, runId, unpublishCreator } from '../helpers/fixtures'
import { request, type Json } from '../helpers/http'
import { VENDOR_URL } from '../helpers/mock-vendor'

/**
 * 运营审核与发布快照（02 `metrics_locked` / 03「发布快照与审计」）。
 *
 * 发布那一刻冻结的数字，就是选人端博主池筛选、排序、分位用的数字；之后的抓取
 * 只改「最新」。下架再发布才换成新数字。有替身供应商时走真实的再抓取
 * （`bb-grow` 每次多 4 万粉丝），没有时那一组跳过，手工改粉丝的一组照常跑。
 *
 * Break: 再抓取后博主池里的粉丝 / 量级跟着变；或下架重发后池子还是旧数字。
 */

let ops: Session
let selector: Session
let live = false
let skipReason = ''
const RUN = runId('bbrev')

type Metrics = { followers: number | null }

async function opsDetail(id: string): Promise<Json> {
  const res = await authed(ops, 'GET', PATHS.opsCreator(id))
  expect(res.status).toBe(200)
  return res.json
}

async function poolRow(id: string, query?: Record<string, string>): Promise<Json | undefined> {
  return (await poolItems(selector, query)).find((row) => row.id === id)
}

async function ingestOnce(keyword: string): Promise<string[]> {
  const res = await authed(ops, 'POST', `${PATHS.ingestFetch}?sync=1`, {
    source: 'qiangua',
    window: 30,
    keyword,
    maxPages: 1,
  })
  expect([201, 202]).toContain(res.status)
  const jobId = String((res.json.job as Json | undefined)?.id ?? res.json.id)
  const deadline = Date.now() + 25_000
  let job = (await authed(ops, 'GET', PATHS.ingestJob(jobId))).json
  while (!['ok', 'partial', 'failed'].includes(String(job.status)) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    job = (await authed(ops, 'GET', PATHS.ingestJob(jobId))).json
  }
  expect(job.status).toBe('ok')
  const sample = await authed(ops, 'GET', PATHS.ingestSample(jobId))
  return (sample.json.items as Json[]).map((row) => String(row.id))
}

beforeAll(async () => {
  ops = await login('ops')
  selector = await login('selector')
  const adapters = await authed(ops, 'GET', PATHS.ingestAdapters)
  const qiangua = (adapters.json.items as Json[]).find((item) => item.id === 'qiangua')
  if (!qiangua?.configured) {
    skipReason = `千瓜未接替身供应商（API 需带 QIANGUA_BASE_URL=${VENDOR_URL} QIANGUA_TOKEN 启动）`
    return
  }
  live = true
}, 60_000)

describe('发布快照 — 再抓取不改博主池（需要替身供应商）', () => {
  let creatorId = ''
  let firstFollowers = 0
  const keyword = `${RUN}-bb-grow`

  it('抓回来的新博主处于待审核，不在博主池', async (context) => {
    if (!live) return context.skip(skipReason)
    const ids = await ingestOnce(keyword)
    expect(ids.length).toBeGreaterThan(0)
    creatorId = ids[0]
    const detail = await opsDetail(creatorId)
    expect(detail.stage).toBe('review')
    expect(detail.metricsLocked).toBeNull()
    firstFollowers = Number((detail.metrics as Metrics).followers)
    expect(firstFollowers).toBeGreaterThan(0)
    expect(await poolRow(creatorId)).toBeUndefined()
  })

  it('通过并发布：池子里的数字等于发布那一刻', async (context) => {
    if (!live) return context.skip(skipReason)
    const res = await publishCreator(ops, creatorId)
    expect(res.status).toBe(200)
    expect(res.json.refreshed).toBe(true)
    const row = await poolRow(creatorId)
    expect(Number(row?.followers)).toBe(firstFollowers)
    expect(row?.metricsLockedAt).toBeTruthy()
    expect((await opsDetail(creatorId)).stage).toBe('released')
  })

  it('再抓一次：最新数字变了，池子、量级、筛选结果都不变', async (context) => {
    if (!live) return context.skip(skipReason)
    expect(await ingestOnce(keyword)).toContain(creatorId)
    const ops1 = await opsDetail(creatorId)
    const latest = Number((ops1.metrics as Metrics).followers)
    expect(latest).toBeGreaterThan(firstFollowers)
    expect(Number((ops1.metricsLocked as Metrics).followers)).toBe(firstFollowers)

    const row = await poolRow(creatorId)
    expect(Number(row?.followers)).toBe(firstFollowers)
    expect(row?.tier).toBe('junior')
    expect(await poolRow(creatorId, { followersMin: String(firstFollowers + 1) })).toBeUndefined()

    const detail = await request('GET', PATHS.poolCreator(creatorId), { token: selector.token })
    expect(Number((detail.json.metrics as Metrics).followers)).toBe(firstFollowers)
    expect(Number((detail.json.metricsLatest as Metrics).followers)).toBe(latest)
  })

  it('已在池中再点发布不刷新；下架后重新发布才换成最新数字', async (context) => {
    if (!live) return context.skip(skipReason)
    const again = await publishCreator(ops, creatorId)
    expect(again.json.refreshed).toBe(false)
    expect(Number((await poolRow(creatorId))?.followers)).toBe(firstFollowers)

    expect((await unpublishCreator(ops, creatorId)).status).toBe(200)
    expect((await opsDetail(creatorId)).stage).toBe('withdrawn')
    expect(await poolRow(creatorId)).toBeUndefined()

    const back = await publishCreator(ops, creatorId)
    expect(back.json.refreshed).toBe(true)
    const row = await poolRow(creatorId)
    expect(Number(row?.followers)).toBeGreaterThan(firstFollowers)
    expect(row?.tier).toBe('mid')
  })
})

describe('发布快照 — 手工改数字', () => {
  it('发布后改粉丝与指标：池子不动，详情并排给出发布时与最新；重发后池子更新', async () => {
    const key = runId('snap')
    const created = await createCreator(ops, {
      creatorKey: key,
      displayName: `快照-${key}`,
      verticals: ['beauty'],
      source: 'pugongying',
      metrics: { window: 30, followers: 20_000, cpe: 2.2, health: 'excellent' },
    })
    const id = String(created.id)
    expect((await publishCreator(ops, id)).status).toBe(200)

    const patch = await authed(ops, 'PATCH', PATHS.opsCreator(id), {
      metrics: { window: 30, followers: 80_000, cpe: 3.9, health: 'normal' },
    })
    expect(patch.status).toBe(200)

    const row = await poolRow(id)
    expect(Number(row?.followers)).toBe(20_000)
    expect(Number((row?.metrics as Json).cpe)).toBe(2.2)
    const detail = await request('GET', PATHS.poolCreator(id), { token: selector.token })
    expect(Number((detail.json.metrics as Json).cpe)).toBe(2.2)
    expect(Number((detail.json.metricsLatest as Json).cpe)).toBe(3.9)

    await unpublishCreator(ops, id)
    await publishCreator(ops, id)
    const after = await poolRow(id)
    expect(Number(after?.followers)).toBe(80_000)
    expect(Number((after?.metrics as Json).cpe)).toBe(3.9)
  })
})

describe('运营端博主列表', () => {
  it('每位博主带「待审核 / 已发布 / 已下架」阶段，概览给出待审核与已下架人数', async () => {
    const key = runId('stage')
    const created = await createCreator(ops, { creatorKey: key, displayName: `阶段-${key}`, followers: 9_000 })
    const id = String(created.id)
    const list = await authed(ops, 'GET', PATHS.opsCreators)
    expect(list.status).toBe(200)
    const mine = (list.json.items as Json[]).find((row) => row.id === id)
    expect(mine?.stage).toBe('review')
    const overview = await authed(ops, 'GET', PATHS.opsOverview)
    const counts = overview.json.counts as Record<string, number>
    expect(counts.pending).toBeGreaterThan(0)
    expect(typeof counts.withdrawn).toBe('number')
  })
})
