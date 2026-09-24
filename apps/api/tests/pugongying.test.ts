import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePugongying, pugongyingAdapter } from '../src/adapters/pugongying'
import { fixturePage } from '../src/adapters/common'
import { recordingMeter } from './meter-stub'

const fixtureUrl = new URL('../src/adapters/fixtures/pugongying.json', import.meta.url)

function record(index: number) {
  return fixturePage('pugongying', fixtureUrl, { source: 'pugongying', window: 30 }).records[index]!
}

describe('蒲公英 normalize (solar field names)', () => {
  it('maps kol + dataV3 payload onto CreatorMetrics without inventing values', () => {
    const result = normalizePugongying(record(0))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { creator } = result
    expect(creator.externalId).toBe('pgy_001')
    expect(creator.creatorKey).toBe('pugongying:pgy_001')
    expect(creator.xhsId).toBe('cheongdam_skin')
    expect(creator.regions).toEqual(['上海', '上海', '徐汇区'])
    expect(creator.verticals).toEqual(expect.arrayContaining(['护肤', '面部保养', '美妆', '测评']))

    const m = creator.metrics
    expect(m.window).toBe(30)
    expect(m.followers).toBe(680000)
    expect(m.followerGrowth).toBe(18200)
    expect(m.followerGrowthRate).toBeCloseTo(0.027, 3)
    expect(m.readFanRatio).toBeCloseTo(0.32, 3)
    expect(m.activeFanRatio).toBeCloseTo(0.78, 3)
    expect(m.engagedFanRatio).toBeCloseTo(0.031, 3)
    expect(m.impressionMedian).toBe(180000)
    expect(m.readMedian).toBe(92000)
    expect(m.interactionMedian).toBe(5600)
    expect(m.likeMedian).toBe(4300)
    expect(m.collectMedian).toBe(980)
    expect(m.commentMedian).toBe(320)
    expect(m.coopReadMedian).toBe(84000)
    expect(m.coopInteractionMedian).toBe(5100)
    expect(m.engagementRate).toBeCloseTo(0.061, 3)
    expect(m.completionRate).toBeCloseTo(0.412, 3)
    expect(m.read3sRate).toBeCloseTo(0.7, 3)
    expect(m.noteCount).toBe(33)
    expect(m.viralRate).toBeCloseTo(0.212, 3)
    expect(m.viralCount).toBeNull()
    expect(m.priceImage).toBe(16800)
    expect(m.priceVideo).toBe(26000)
    expect(m.cpr).toBe(0.18)
    expect(m.cpe).toBe(3)
    expect(m.cpm).toBe(91.3)
    expect(m.trafficSearchRatio).toBe(0.18)
    expect(m.trafficRecommendRatio).toBe(0.75)
    expect(m.trafficFollowRatio).toBe(0.03)
    expect(m.health).toBeNull()
    expect(m.lowActive).toBe(false)
    expect(m.authenticity).toBeNull()
    expect(m.coopNoteCount).toBe(6)
    expect(m.audience?.femaleRatio).toBe(0.86)
    expect(m.audience?.ageBands[2]).toEqual({ band: '25-34', ratio: 0.44 })
    expect(m.audience?.topRegions[0]).toEqual({ name: '上海', ratio: 0.19 })
    expect(m.vendorIndex).toBeNull()
    expect(creator.warnings).toEqual([])
  })

  it('falls back to list-level fields and treats 0 medians as not shown', () => {
    const result = normalizePugongying(record(1))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const m = result.creator.metrics
    expect(m.readMedian).toBe(61000)
    expect(m.interactionMedian).toBe(4100)
    expect(m.impressionMedian).toBe(126000)
    expect(m.likeMedian).toBeNull()
    expect(m.noteCount).toBeNull()
    expect(m.engagementRate).toBeCloseTo(4100 / 61000, 4)
    expect(m.cpe).toBe(2.39)
    expect(m.health).toBeNull()
    expect(m.audience).toBeNull()
  })

  it('keeps 低活跃 as its own flag instead of turning it into a health grade', () => {
    const low = normalizePugongying(record(7))
    const active = normalizePugongying(record(0))
    expect(low.ok && low.creator.metrics.health).toBeNull()
    expect(low.ok && low.creator.signals?.lowActive).toBe(true)
    expect(low.ok && low.creator.metrics.lowActive).toBe(true)
    expect(active.ok && active.creator.signals).toMatchObject({ lowActive: false, recentlyActive: true, healthLevel: null })
    const bare = normalizePugongying({ ...record(1), payload: { userId: 'x', name: 'y' } })
    expect(bare.ok && bare.creator.metrics.health).toBeNull()
    expect(bare.ok && bare.creator.signals?.lowActive).toBeNull()
    expect(bare.ok && bare.creator.warnings).toContain('followers.missing')
  })

  it('keeps 完播率 and 3 秒阅读率 apart, and the 30-day and all-time 合作笔记 apart', () => {
    const result = normalizePugongying(record(0))
    if (!result.ok) throw new Error(result.errors.join())
    const { metrics, signals } = result.creator
    expect(metrics.completionRate).toBeCloseTo(0.412, 10)
    expect(metrics.read3sRate).toBeCloseTo(0.7, 10)
    expect(signals?.completionRate).toBeCloseTo(0.412, 10)
    expect(signals?.read3sRate).toBeCloseTo(0.7, 10)
    expect(metrics.coopNoteCount).toBe(6)
    expect(signals?.coopNoteCountTotal).toBe(241)
    expect(signals?.windowDays).toMatchObject({ activeFanRatio: 28, engagedFanRatio: 30, coopNoteCount: 30 })
  })

  it('reads the platform\'s own 「超过 X% 同类博主」ranks', () => {
    const result = normalizePugongying(record(0))
    if (!result.ok) throw new Error(result.errors.join())
    expect(result.creator.signals?.platformRanks).toMatchObject({
      readMedian: 0.9, impressionMedian: 0.9, interactionRate: 0.85, followerGrowth: 0.8,
      activeFanRatio: 0.6, engagedFanRatio: 0.7, readFanRatio: 0.65, completionRate: 0.5,
    })
  })

  it('reads 外溢进店 UV and 单价 when the response carries them (field names 待实测)', () => {
    const result = normalizePugongying({ ...record(1), payload: { userId: 'x', name: 'y', notesRate: { mCpuvNum: '1,200', estimateCpuv: '3.5' } } })
    if (!result.ok) throw new Error(result.errors.join())
    expect(result.creator.signals).toMatchObject({ storeVisitUvMedian: 1200, storeVisitUnitPrice: 3.5 })
  })
})

describe('蒲公英 gateways', () => {
  const env = { ...process.env }
  let calls: { url: string; init: RequestInit }[]

  beforeEach(() => {
    calls = []
    process.env.PGY_ACCESS_TOKEN = 'test-token'
    delete process.env.PGY_BASE_URL
    delete process.env.PGY_BRAND_USER_ID
    delete process.env.PGY_ENRICH
    delete process.env.PGY_DATE_TYPES
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

  it('tikhub: builds the grouped filter body and unwraps data.data', async () => {
    process.env.PGY_GATEWAY = 'tikhub'
    const kol = record(1).payload
    stubFetch(() => ({ code: 200, request_id: 'req-list-1', data: { code: 0, success: true, data: { kols: [kol], total: 5000 } } }))
    const billing = recordingMeter()
    const page = await pugongyingAdapter.fetch({
      source: 'pugongying', window: 30, keyword: '空瓶', category: '美妆', region: '上海',
      followersMin: 10000, followersMax: 500000, priceMin: 2000, health: ['healthy'], cursor: '3',
    }, { meter: billing.meter })
    expect((page as { sourceMode?: string }).sourceMode).toBe('live')
    expect(page.records).toHaveLength(1)
    expect(page.records[0]!.externalId).toBe('pgy_002')
    expect(page.nextCursor).toBeNull()
    expect(calls).toHaveLength(1)
    expect(billing.acquired).toEqual(['tikhub:/api/v1/xiaohongshu/pgy/get_blogger_list'])
    expect(billing.settled).toMatchObject([{ outcome: 'billed', status: 200, requestId: 'req-list-1', empty: false }])
    expect(calls[0]!.url).toBe('https://api.tikhub.io/api/v1/xiaohongshu/pgy/get_blogger_list')
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer test-token')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      page_num: 3, page_size: 20, keyword: '空瓶', search_type: 1, column: 'comprehensiverank', sort: 'desc',
      fans: { count: { min: 10000, max: 500000 } },
      coop: { pic_price: { min: 2000 } },
      blogger: { content_tag: ['美妆'], location: ['上海'] },
      flags: { exclude_low_active: true },
    })
  })

  it('tikhub: externalIds refresh = detail + 4 dataV3 calls merged into one payload', async () => {
    process.env.PGY_GATEWAY = 'tikhub'
    const detail = record(1).payload
    stubFetch((url) => {
      if (url.endsWith('get_blogger_detail')) return { data: { data: detail } }
      if (url.endsWith('get_blogger_fans_summary')) return { data: { data: { fansNum: 286000, readFansRate: '29.0' } } }
      if (url.endsWith('get_blogger_notes_rate')) return { data: { data: { noteNumber: 18, interactionRate: '6.7' } } }
      return { data: { data: null } }
    })
    const billing = recordingMeter()
    const page = await pugongyingAdapter.fetch({ source: 'pugongying', window: 90, externalIds: ['pgy_002'] }, { meter: billing.meter })
    expect(calls).toHaveLength(5)
    // Each one went through the meter before it was sent, and each 200 is billed (empty ones too).
    expect(billing.acquired).toHaveLength(5)
    expect(billing.settled.map((s) => s.outcome)).toEqual(['billed', 'billed', 'billed', 'billed', 'billed'])
    expect(billing.settled.filter((s) => s.empty).map((s) => s.endpoint)).toEqual([
      'tikhub:/api/v1/xiaohongshu/pgy/get_blogger_data_summary',
      'tikhub:/api/v1/xiaohongshu/pgy/get_blogger_fans_profile',
    ])
    const notesCall = calls.find((c) => c.url.endsWith('get_blogger_notes_rate'))!
    // Docs: 1 = 30 天, 2 = 90 天, 3 → 422 (待实测).
    expect(JSON.parse(String(notesCall.init.body))).toMatchObject({ user_id: 'pgy_002', date_type: 2, business: 0, note_type: 3 })
    const raw = page.records[0]!
    expect(raw.payload.kcsWindow).toBe(90)
    expect(raw.payload.kcsDateType).toBe(2)
    const result = pugongyingAdapter.normalize(raw)
    expect(result.ok && result.creator.metrics.window).toBe(90)
    expect(result.ok && result.creator.metrics.readFanRatio).toBeCloseTo(0.29, 3)
    expect(result.ok && result.creator.metrics.noteCount).toBe(18)
    expect(result.ok && result.creator.metrics.engagementRate).toBeCloseTo(0.067, 3)
  })

  it('dateType: 30 天 is 1 and 90 天 is 2 on TikHub / official (never 3), a string enum on JustOneAPI, and PGY_DATE_TYPES overrides both', async () => {
    const detail = record(1).payload
    const notesParams = async (gateway: string, window: 30 | 90) => {
      calls = []
      process.env.PGY_GATEWAY = gateway
      stubFetch((url) => (/detail|user\/blogger/.test(url) ? { data: { data: detail, ...detail } } : { data: { data: null } }))
      const page = await pugongyingAdapter.fetch({ source: 'pugongying', window, externalIds: ['pgy_002'] })
      const call = calls.find((c) => /notes_?[rR]ate/.test(c.url))!
      const sent = call.init.body ? JSON.parse(String(call.init.body)).date_type : new URL(call.url).searchParams.get('dateType')
      return { sent, stored: page.records[0]?.payload.kcsDateType }
    }
    expect(await notesParams('tikhub', 30)).toEqual({ sent: 1, stored: 1 })
    expect(await notesParams('tikhub', 90)).toEqual({ sent: 2, stored: 2 })
    expect(await notesParams('official', 90)).toEqual({ sent: '2', stored: 2 })
    expect(await notesParams('justoneapi', 30)).toEqual({ sent: 'DAY_30', stored: 'DAY_30' })
    expect(await notesParams('justoneapi', 90)).toEqual({ sent: 'DAY_90', stored: 'DAY_90' })
    process.env.PGY_DATE_TYPES = '{"30":"DAY_30","90":"DAY_90"}'
    expect(await notesParams('tikhub', 30)).toEqual({ sent: 'DAY_30', stored: 'DAY_30' })
    process.env.PGY_DATE_TYPES = 'not json'
    expect(await notesParams('tikhub', 90)).toEqual({ sent: 2, stored: 2 })
  })

  it('justoneapi: GET with token query and one-layer data', async () => {
    process.env.PGY_GATEWAY = 'justoneapi'
    stubFetch(() => ({ code: 0, data: { kols: [record(3).payload], total: 1 }, message: null }))
    const page = await pugongyingAdapter.fetch({ source: 'pugongying', window: 30, followersMin: 50000, priceMax: 5000, health: ['healthy'] })
    expect(page.records[0]!.externalId).toBe('pgy_004')
    const url = new URL(calls[0]!.url)
    expect(url.origin + url.pathname).toBe('https://api.justoneapi.com/api/xiaohongshu-pgy/api/solar/cooperator/blogger/v2/v1')
    expect(url.searchParams.get('token')).toBe('test-token')
    expect(url.searchParams.get('fansNumberLower')).toBe('50000')
    expect(url.searchParams.get('notePrice')).toBe('0,5000')
    expect(url.searchParams.get('excludeLowActive')).toBe('true')
    expect(calls[0]!.init.method).toBe('GET')
  })

  it('official: posts the console body shape to PGY_BASE_URL', async () => {
    process.env.PGY_GATEWAY = 'official'
    process.env.PGY_BASE_URL = 'https://openapi.example.test/'
    stubFetch(() => ({ code: 0, success: true, data: { kols: [], total: 0 } }))
    const page = await pugongyingAdapter.fetch({ source: 'pugongying', window: 30, keyword: '护肤', followersMax: 80000 })
    expect(page.records).toEqual([])
    expect(page.nextCursor).toBeNull()
    expect(calls[0]!.url).toBe('https://openapi.example.test/api/solar/cooperator/blogger/v2')
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ keyword: '护肤', fansNumberUpper: 80000, pageNum: 1, pageSize: 20 })
  })

  it('without PGY_ACCESS_TOKEN falls back to the fixture', async () => {
    delete process.env.PGY_ACCESS_TOKEN
    const page = await pugongyingAdapter.fetch({ source: 'pugongying', window: 30, health: ['abnormal'] })
    expect((page as { sourceMode?: string }).sourceMode).toBe('fixture')
    expect(page.records.map((r) => r.externalId)).toEqual(['pgy_008'])
  })
})
