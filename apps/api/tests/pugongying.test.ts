import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePugongying, pugongyingAdapter } from '../src/adapters/pugongying'
import { fixturePage } from '../src/adapters/common'
import { adapterConfigured, adapterDescriptions } from '../src/adapters'
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
    // 21.2% of 33 notes, read back from the same notesRate answer.
    expect(m.viralCount).toBe(7)
    expect(m.basis.viralCount).toBe('notesRate.thousandLikePercent*noteNumber')
    expect(m.priceImage).toBe(16800)
    expect(m.priceVideo).toBe(26000)
    expect(m.cpr).toBe(0.18)
    expect(m.cpe).toBe(3)
    expect(m.cpm).toBe(91.3)
    // estimateVideoEngageCost is 0 (not shown), so the video CPE is derived from the video price.
    expect(m.cpeVideo).toBeCloseTo(26000 / 5100, 6)
    expect(m.basis.cpeVideo).toBe('priceVideo/coopInteractionMedian')
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

  it('a 90-day record carries only what notesRate returned for 90 days — no 30-day number under a 90 label', () => {
    const base = record(0).payload
    const notesRate = { noteNumber: 40, readMedian: 50000, interactionMedian: 3000, thousandLikePercent: '10.0' }
    const at = (window: 30 | 90) => {
      const result = normalizePugongying({ ...record(0), payload: { ...base, kcsWindow: window, notesRate } })
      if (!result.ok) throw new Error(result.errors.join())
      return result.creator
    }
    const long = at(90)
    const m = long.metrics
    expect(m.window).toBe(90)
    expect(m.readMedian).toBe(50000)
    expect(m.interactionMedian).toBe(3000)
    expect(m.noteCount).toBe(40)
    expect(m.viralRate).toBeCloseTo(0.1, 6)
    expect(m.viralCount).toBe(4)
    // The list and 数据概览 carry 30-day values for all of these; none may stand in.
    expect(m.impressionMedian).toBeNull()
    expect(m.coopReadMedian).toBeNull()
    expect(m.coopInteractionMedian).toBeNull()
    expect(m.likeMedian).toBeNull()
    expect(m.completionRate).toBeNull()
    expect(m.cpm).toBeNull()
    // The platform's 30-day unit costs give way to ones derived from the 90-day medians.
    expect(m.cpe).toBeCloseTo(16800 / 3000, 6)
    expect(m.basis.cpe).toBe('priceImage/interactionMedian')
    expect(m.cpr).toBeCloseTo(16800 / 50000, 6)
    expect(m.platformRanks?.readMedian).toBeUndefined()
    expect(m.platformRanks?.engagementRate).toBeUndefined()
    // Fan facts keep their own fixed window, and say so.
    expect(m.followerGrowth).toBe(18200)
    expect(m.activeFanRatio).toBeCloseTo(0.78, 3)
    expect(long.signals?.windowDays).toMatchObject({ followerGrowth: 30, activeFanRatio: 28, engagedFanRatio: 30, readFanRatio: 30 })

    // The same payload read for 30 days may use the list and 数据概览 values.
    const short = at(30).metrics
    expect(short.impressionMedian).toBe(180000)
    expect(short.coopReadMedian).toBe(84000)
    expect(short.cpe).toBe(3)
    expect(short.platformRanks?.readMedian).toBeCloseTo(0.9, 6)
  })

  it('a record without any 健康等级 field has unknown health, never 健康', () => {
    const result = normalizePugongying({ ...record(0), payload: { ...record(0).payload, lowActive: true } })
    expect(result.ok && result.creator.metrics.health).toBeNull()
    expect(result.ok && result.creator.metrics.lowActive).toBe(true)
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
    delete process.env.TIKHUB_API_KEY
    delete process.env.TIKHUB_BASE_URL
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

  it('tikhub: externalIds refresh = detail + dataV3 calls merged into one payload (an empty 合作 summary is asked again on 日常)', async () => {
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
    // detail, 数据概览 合作 (empty) + 日常, 粉丝, 笔记表现 自然流量, 粉丝画像, 笔记表现 含投放.
    expect(calls).toHaveLength(7)
    // Each one went through the meter before it was sent, and each 200 is billed (empty ones too).
    expect(billing.acquired).toHaveLength(7)
    expect(billing.settled.map((s) => s.outcome)).toEqual(Array(7).fill('billed'))
    expect(billing.settled.filter((s) => s.empty).map((s) => s.endpoint)).toEqual([
      'tikhub:/api/v1/xiaohongshu/pgy/get_blogger_data_summary',
      'tikhub:/api/v1/xiaohongshu/pgy/get_blogger_data_summary',
      'tikhub:/api/v1/xiaohongshu/pgy/get_blogger_fans_profile',
    ])
    const notesCall = calls.find((c) => c.url.endsWith('get_blogger_notes_rate'))!
    // Docs: 1 = 30 天, 2 = 90 天, 3 → 422 (待实测).
    expect(JSON.parse(String(notesCall.init.body))).toMatchObject({ user_id: 'pgy_002', date_type: 2, business: 0, note_type: 3 })
    const raw = page.records[0]!
    expect(raw.payload.kcsWindow).toBe(90)
    expect(raw.payload.kcsDateType).toBe(2)
    expect(raw.payload.kcsScope).toEqual({ traffic: 'organic', business: 'daily' })
    expect(raw.payload.kcsCostFallback).toMatchObject({ requested: 'coop', reason: 'noCoopData' })
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

  it('scope: business / advertise_switch follow the source scope and are recorded on the payload and in basis', async () => {
    const detail = record(1).payload
    const refresh = async (gateway: string, scope?: { traffic: 'all' | 'organic'; business: 'daily' | 'coop' }, coopCost = true) => {
      calls = []
      process.env.PGY_GATEWAY = gateway
      const paramsOf = (call: { url: string; init: RequestInit }) =>
        call.init.body ? JSON.parse(String(call.init.body)) : Object.fromEntries(new URL(call.url).searchParams)
      const answer = (data: unknown) => (gateway === 'tikhub' ? { code: 200, data: { code: 0, success: true, data } } : { code: 0, success: true, data })
      stubFetch((url, init) => {
        if (/detail|user\/blogger/.test(url)) return answer(detail)
        const asked = paramsOf({ url, init })
        if (/notes_?[rR]ate/.test(url)) {
          // 含投放 answers carry more reach than 自然流量 ones.
          const all = String(asked.advertise_switch ?? asked.advertiseSwitch) === '1'
          return answer({ noteNumber: 10, readMedian: all ? 1500 : 900, interactionRate: all ? '5.0' : '4.0' })
        }
        const coop = String(asked.business) === '1'
        return answer(coop && !coopCost ? { noteNumber: 10 } : { noteNumber: 10, estimatePictureEngageCost: coop ? 150 : 90 })
      })
      const page = await pugongyingAdapter.fetch({ source: 'pugongying', window: 30, externalIds: ['pgy_002'] }, scope ? { scope } : undefined)
      const all = (pattern: RegExp) => calls.filter((c) => pattern.test(c.url)).map(paramsOf)
      const result = pugongyingAdapter.normalize(page.records[0]!)
      if (!result.ok) throw new Error(result.errors.join())
      return {
        notes: all(/notes_?[rR]ate/),
        summaries: all(/data_?[sS]ummary/),
        payload: page.records[0]!.payload,
        basis: result.creator.metrics.basis,
        metrics: result.creator.metrics,
      }
    }
    // Default: cost on 合作笔记, reach on 自然流量 (read on 日常笔记), plus the 含投放 reference.
    const byDefault = await refresh('tikhub')
    expect(byDefault.notes).toMatchObject([{ business: 0, advertise_switch: 0 }, { business: 0, advertise_switch: 1 }])
    expect(byDefault.summaries).toMatchObject([{ business: 1 }])
    expect(byDefault.payload.kcsScope).toEqual({ traffic: 'organic', business: 'coop' })
    expect(byDefault.basis).toMatchObject({ trafficScope: 'organic', businessScope: 'coop' })
    expect(byDefault.basis.costFallback).toBeUndefined()
    expect(byDefault.metrics.cpe).toBe(150)
    expect(byDefault.metrics.readMedian).toBe(900)
    expect(byDefault.metrics.allTraffic).toMatchObject({ readMedian: 1500, engagementRate: 0.05 })

    // No 合作 cost → asked again on 日常 and recorded as such.
    const noCoop = await refresh('tikhub', undefined, false)
    expect(noCoop.summaries).toMatchObject([{ business: 1 }, { business: 0 }])
    expect(noCoop.payload.kcsScope).toEqual({ traffic: 'organic', business: 'daily' })
    expect(noCoop.payload.dataSummaryCoop).toEqual({ noteNumber: 10 })
    expect(noCoop.basis).toMatchObject({ trafficScope: 'organic', businessScope: 'daily', costFallback: 'noCoopData' })
    // On 日常 the list / 资料 estimate comes first, as before.
    expect(noCoop.metrics.cpe).toBe(Number(detail.estimatePictureEngageCost))

    // All traffic on 日常: one notes-rate call, no reference.
    const allDaily = await refresh('tikhub', { traffic: 'all', business: 'daily' })
    expect(allDaily.notes).toMatchObject([{ business: 0, advertise_switch: 1 }])
    expect(allDaily.summaries).toMatchObject([{ business: 0 }])
    expect(allDaily.basis).toMatchObject({ trafficScope: 'all', businessScope: 'daily' })
    expect(allDaily.metrics.allTraffic).toBeNull()

    const official = await refresh('official', { traffic: 'organic', business: 'coop' })
    expect(official.notes[0]).toMatchObject({ business: '0', advertiseSwitch: '0' })
    expect(official.summaries[0]).toMatchObject({ business: '1' })

    // A record fetched before scopes existed (or from a fixture) says nothing rather than guessing.
    const bare = normalizePugongying(record(0))
    expect(bare.ok && bare.creator.metrics.basis.trafficScope).toBeUndefined()
  })

  it('a creator known to have no 合作 cost skips the 合作 call until the check is a month old', async () => {
    process.env.PGY_GATEWAY = 'tikhub'
    delete process.env.PGY_SLOW_REFRESH_DAYS
    const detail = record(1).payload
    stubFetch((url) => (url.endsWith('get_blogger_detail') ? { data: { data: detail } } : { data: { data: { noteNumber: 4 } } }))
    const first = await pugongyingAdapter.fetch({ source: 'pugongying', window: 30, externalIds: ['pgy_002'] })
    const previous = { payload: first.records[0]!.payload, fetchedAt: first.records[0]!.fetchedAt }
    const summaries = () => calls.filter((c) => c.url.endsWith('get_blogger_data_summary')).map((c) => JSON.parse(String(c.init.body)).business)
    expect(summaries()).toEqual([1, 0])
    calls = []
    const again = await pugongyingAdapter.fetch({ source: 'pugongying', window: 30, externalIds: ['pgy_002'] }, { previous: async () => previous })
    expect(summaries()).toEqual([0])
    expect(again.records[0]!.payload.kcsCostFallback).toMatchObject({ checkedAt: (previous.payload.kcsCostFallback as { checkedAt: string }).checkedAt })
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

  it('TIKHUB_API_KEY + TIKHUB_BASE_URL: Bearer key to the configured host; the ops page says which gateway and host, never the key', async () => {
    delete process.env.PGY_ACCESS_TOKEN
    delete process.env.PGY_GATEWAY
    process.env.TIKHUB_API_KEY = 'th-key'
    process.env.TIKHUB_BASE_URL = 'https://api.tikhub.dev/'
    stubFetch(() => ({ code: 200, request_id: 'r', data: { code: 0, success: true, data: { kols: [], total: 5000 } } }))
    await pugongyingAdapter.fetch({ source: 'pugongying', window: 30, keyword: 'x' })
    expect(calls[0]!.url).toBe('https://api.tikhub.dev/api/v1/xiaohongshu/pgy/get_blogger_list')
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer th-key')
    expect(adapterConfigured('pugongying')).toBe(true)
    const card = adapterDescriptions().find((a) => a.id === 'pugongying')!
    expect(card).toMatchObject({ configured: true, envVars: ['TIKHUB_API_KEY'], access: { gateway: 'tikhub', host: 'api.tikhub.dev', legacyCredential: false } })
    expect(JSON.stringify(card)).not.toContain('th-key')

    // The older names still work, and the card says it is the older setup.
    delete process.env.TIKHUB_API_KEY
    delete process.env.TIKHUB_BASE_URL
    process.env.PGY_ACCESS_TOKEN = 'old-key'
    process.env.PGY_GATEWAY = 'tikhub'
    calls = []
    await pugongyingAdapter.fetch({ source: 'pugongying', window: 30, keyword: 'x' })
    expect(calls[0]!.url).toBe('https://api.tikhub.io/api/v1/xiaohongshu/pgy/get_blogger_list')
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer old-key')
    expect(adapterDescriptions().find((a) => a.id === 'pugongying')!.access).toEqual({ gateway: 'tikhub', host: 'api.tikhub.io', legacyCredential: true })

    delete process.env.PGY_ACCESS_TOKEN
    expect(adapterConfigured('pugongying')).toBe(false)
    expect(adapterDescriptions().find((a) => a.id === 'pugongying')!.access).toBeNull()
  })

  it('without PGY_ACCESS_TOKEN falls back to the fixture', async () => {
    delete process.env.PGY_ACCESS_TOKEN
    const page = await pugongyingAdapter.fetch({ source: 'pugongying', window: 30, health: ['abnormal'] })
    expect((page as { sourceMode?: string }).sourceMode).toBe('fixture')
    expect(page.records.map((r) => r.externalId)).toEqual(['pgy_008'])
  })
})
