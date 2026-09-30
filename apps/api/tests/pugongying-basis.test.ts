import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePugongying, pugongyingAdapter } from '../src/adapters/pugongying'
import type { RawRecord } from '@kcs/contract'

/**
 * Break: a creator whose 图文/视频 channel is not open (pictureState /
 * videoState 0) still gets a quote, and cpr/cpe derive from it. And a
 * 合作口径 record whose cost metrics all fell back to 自然 denominators
 * carries no `basis.costFallback` mark outside the enrich path.
 */
describe('pugongying basis and channel-state fixes', () => {
  const env = { ...process.env }
  let calls: Array<{ url: string; init: RequestInit }>

  beforeEach(() => {
    calls = []
    process.env.PGY_ACCESS_TOKEN = 'test-token'
    delete process.env.TIKHUB_API_KEY
    delete process.env.TIKHUB_BASE_URL
    delete process.env.PGY_BASE_URL
    delete process.env.PGY_ENRICH
  })
  afterEach(() => {
    process.env = { ...env }
    vi.unstubAllGlobals()
  })

  function stubFetch(reply: (url: string, init: RequestInit) => unknown) {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify(reply(url, init)), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
  }

  const raw = (payload: Record<string, unknown>): RawRecord => ({
    source: 'pugongying',
    platform: 'xhs',
    externalId: String(payload.userId),
    fetchedAt: '2026-09-30T00:00:00.000Z',
    payload,
  })

  it('pictureState/videoState 0 (未开通) nulls the quote and its derived cpr/cpe', () => {
    const result = normalizePugongying(raw({
      userId: 'pgy_state',
      name: '未开通图文',
      picturePrice: 16800,
      pictureState: 0,
      videoPrice: 26000,
      videoState: 1,
      notesRate: { readMedian: 90000, interactionMedian: 5600 },
      kcsWindow: 30,
      kcsScope: { traffic: 'all', business: 'daily' },
    }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const m = result.creator.metrics
    expect(m.priceImage).toBeNull()
    expect(m.priceVideo).toBe(26000)
    // Nothing derives off the closed 图文 channel.
    expect(m.cpr).toBeNull()
    expect(m.cpe).toBeNull()
    expect(m.cpmRead).toBeNull()
    // The open 视频 channel still prices.
    expect(m.cpeVideo).toBeCloseTo(26000 / 5600, 6)
    // A missing state field keeps the old behavior: the quote stands.
    const bare = normalizePugongying(raw({
      userId: 'pgy_state2',
      name: '无状态字段',
      picturePrice: 5200,
      notesRate: { readMedian: 90000, interactionMedian: 5600 },
      kcsWindow: 30,
      kcsScope: { traffic: 'all', business: 'daily' },
    }))
    expect(bare.ok && bare.creator.metrics.priceImage).toBe(5200)
  })

  it('a coop-scoped record whose cost fell back to natural medians is flagged (no enrich marker needed)', () => {
    const result = normalizePugongying(raw({
      userId: 'pgy_coop',
      name: '合作口径无合作数据',
      picturePrice: 16800,
      pictureState: 1,
      notesRate: { readMedian: 90000, interactionMedian: 5600 },
      kcsWindow: 30,
      kcsScope: { traffic: 'all', business: 'coop' },
    }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const m = result.creator.metrics
    expect(m.basis.businessScope).toBe('coop')
    expect(m.cpr).toBeCloseTo(16800 / 90000, 6)
    expect(m.basis.cpr).toBe('priceImage/readMedian')
    expect(m.basis.costFallback).toBe('noCoopData')
  })

  it('coop medians present → the record is genuinely coop, no fallback flag', () => {
    const result = normalizePugongying(raw({
      userId: 'pgy_coop2',
      name: '真有合作数据',
      picturePrice: 16800,
      pictureState: 1,
      notesRate: { readMedian: 90000, interactionMedian: 5600 },
      readMidCoop30: 84000,
      interMidCoop30: 5100,
      kcsWindow: 30,
      kcsScope: { traffic: 'all', business: 'coop' },
    }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const m = result.creator.metrics
    expect(m.basis.cpr).toBe('priceImage/coopReadMedian')
    expect(m.basis.costFallback).toBeUndefined()
  })

  it('a coop cost estimate from the vendor is coop data — no record-level flag', () => {
    // Like the enrich path when the 合作 summary answered with cost data.
    const result = normalizePugongying(raw({
      userId: 'pgy_coop3',
      name: '合作有报价',
      picturePrice: 16800,
      pictureState: 1,
      notesRate: { readMedian: 90000, interactionMedian: 5600 },
      dataSummary: { estimatePictureEngageCost: 150 },
      kcsWindow: 30,
      kcsScope: { traffic: 'all', business: 'coop' },
    }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.creator.metrics.cpe).toBe(150)
    expect(result.creator.metrics.basis.costFallback).toBeUndefined()
  })

  it('non-enrich list fetch stamps the configured scope, and its silent fallback gets flagged', async () => {
    process.env.PGY_GATEWAY = 'justoneapi'
    stubFetch(() => ({ code: 0, data: { kols: [{
      userId: 'pgy_list',
      name: '列表抓的',
      picturePrice: 16800,
      pictureState: 1,
      clickMidNum: 92000,
      interMidNum: 5600,
      estimatePictureEngageCost: 3.0,
    }], total: 1 }, message: null }))
    const page = await pugongyingAdapter.fetch(
      { source: 'pugongying', window: 30 },
      { scope: { traffic: 'all', business: 'coop' } },
    )
    const payload = page.records[0]!.payload as Record<string, unknown>
    expect(payload.kcsScope).toEqual({ traffic: 'all', business: 'coop' })
    const result = normalizePugongying(page.records[0]!)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const m = result.creator.metrics
    expect(m.basis.businessScope).toBe('coop')
    // 合作口径只认 dataSummary 的成本字段；列表里的日常估计不当合作报价用，
    // 成本指标回退到自然分母并打标。
    expect(m.basis.cpe).toBe('priceImage/interactionMedian')
    expect(m.basis.costFallback).toBe('noCoopData')
  })
})
