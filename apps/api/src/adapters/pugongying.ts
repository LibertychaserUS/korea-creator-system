/**
 * 蒲公英 adapter.
 *
 * Field names below are the platform's own `solar` schema, confirmed against
 * pgy.xiaohongshu.com responses that TikHub and JustOneAPI relay unchanged:
 *
 *   列表   POST /api/solar/cooperator/blogger/v2               → data.kols[]  (~140 fields per kol)
 *   资料   GET  /api/solar/cooperator/user/blogger/{userId}    → data
 *   数据概览 GET  /api/solar/kol/dataV3/dataSummary?userId&business=0
 *   粉丝概览 GET  /api/solar/kol/dataV3/fansSummary?userId
 *   笔记表现 GET  /api/solar/kol/dataV3/notesRate?userId&business=0&noteType=3&dateType=1|2&advertiseSwitch=1
 *   粉丝画像 GET  /api/solar/kol/data/{userId}/fans_profile
 *
 * RawRecord.payload is the kol item (or the 资料 object) with the four data
 * responses merged under `dataSummary` / `fansSummary` / `notesRate` /
 * `fansProfile` when enrichment ran. Enrichment costs 4 extra billed calls per
 * creator on paid gateways, so it is on for `externalIds` refreshes and opt-in
 * (`PGY_ENRICH=1`) for searches.
 *
 * Gateway is chosen by `PGY_GATEWAY` (official | tikhub | justoneapi); every
 * gateway answers with the same `data` object so normalize() is shared.
 */
import {
  creatorKeyFor,
  deriveMetrics,
  emptyMetrics,
  isPlaceholder,
  pickPath,
  toCount,
  toNumber,
  toRatio,
  type AudienceProfile,
  type CreatorMetrics,
  type HealthGrade,
  type NormalizeResult,
  type PgyGateway,
  type RawRecord,
  type SourceAdapter,
  type SourceQuery,
} from '@kcs/contract'
import { filterFixturePage, fixturePage, type AdapterPage } from './common'

type Json = Record<string, unknown>

const PAGE_SIZE = 20
const TIMEOUT_MS = 12_000

// ---------------------------------------------------------------------------
// Gateways
// ---------------------------------------------------------------------------

type Gateway = {
  list(query: SourceQuery, pageNum: number): Promise<Json | null>
  detail(userId: string): Promise<Json | null>
  dataSummary(userId: string): Promise<Json | null>
  fansSummary(userId: string): Promise<Json | null>
  notesRate(userId: string, window: SourceQuery['window']): Promise<Json | null>
  fansProfile(userId: string): Promise<Json | null>
}

async function http(url: string, init: RequestInit): Promise<Json> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error(`pugongying HTTP ${response.status}`)
    return (await response.json()) as Json
  } finally {
    clearTimeout(timer)
  }
}

function range(min?: number, max?: number): Json | undefined {
  if (min == null && max == null) return undefined
  const out: Json = {}
  if (min != null) out.min = min
  if (max != null) out.max = max
  return out
}

/** Only exclude 低活 when the caller does not want abnormal creators back. */
function wantsLowActiveExcluded(query: SourceQuery): boolean {
  return Boolean(query.health?.length && !query.health.includes('abnormal'))
}

/** TikHub — POST JSON, Bearer token, payload two layers deep (`data.data`). */
function tikhub(token: string, base: string): Gateway {
  const call = async (path: string, body: Json): Promise<Json | null> => {
    const json = await http(`${base}/api/v1/xiaohongshu/pgy/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const envelope = json.data as Json | null | undefined
    return (envelope?.data as Json | null | undefined) ?? null
  }
  return {
    list(query, pageNum) {
      const body: Json = {
        page_num: pageNum,
        page_size: PAGE_SIZE,
        keyword: query.keyword ?? '',
        search_type: 1,
        column: 'comprehensiverank',
        sort: 'desc',
      }
      if (process.env.PGY_BRAND_USER_ID) body.brand_user_id = process.env.PGY_BRAND_USER_ID
      const fans = range(query.followersMin, query.followersMax)
      if (fans) body.fans = { count: fans }
      const price = range(query.priceMin, query.priceMax)
      if (price) body.coop = { pic_price: price }
      const blogger: Json = {}
      if (query.category) blogger.content_tag = [query.category]
      if (query.region) blogger.location = [query.region]
      if (Object.keys(blogger).length) body.blogger = blogger
      if (wantsLowActiveExcluded(query)) body.flags = { exclude_low_active: true }
      return call('get_blogger_list', body)
    },
    detail: (userId) => call('get_blogger_detail', { user_id: userId }),
    dataSummary: (userId) => call('get_blogger_data_summary', { user_id: userId, business: 0 }),
    fansSummary: (userId) => call('get_blogger_fans_summary', { user_id: userId }),
    notesRate: (userId, window) =>
      call('get_blogger_notes_rate', { user_id: userId, business: 0, note_type: 3, date_type: window === 90 ? 2 : 1, advertise_switch: 1 }),
    fansProfile: (userId) => call('get_blogger_fans_profile', { user_id: userId }),
  }
}

/** JustOneAPI — GET with `token` query param, payload one layer deep (`data`). */
function justoneapi(token: string, base: string): Gateway {
  const call = async (path: string, params: Record<string, string | number | boolean | undefined>): Promise<Json | null> => {
    const url = new URL(`${base}/api/xiaohongshu-pgy/api/solar/${path}`)
    url.searchParams.set('token', token)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
    const json = await http(url.toString(), { method: 'GET' })
    return (json.data as Json | null | undefined) ?? null
  }
  const bounds = (min?: number, max?: number) => (min == null && max == null ? undefined : `${min ?? 0},${max ?? -1}`)
  return {
    list: (query, pageNum) =>
      call('cooperator/blogger/v2/v1', {
        searchType: 'NOTE',
        keyword: query.keyword,
        page: pageNum,
        sort: 'DEFAULT',
        fansNumberLower: query.followersMin,
        fansNumberUpper: query.followersMax,
        notePrice: bounds(query.priceMin, query.priceMax),
        contentTag: query.category,
        location: query.region,
        excludeLowActive: wantsLowActiveExcluded(query) || undefined,
      }),
    detail: (userId) => call('cooperator/user/blogger/userId/v1', { userId }),
    dataSummary: (userId) => call('kol/dataV3/dataSummary/v1', { userId, business: 0 }),
    fansSummary: (userId) => call('kol/dataV3/fansSummary/v1', { userId }),
    notesRate: (userId, window) =>
      call('kol/dataV3/notesRate/v1', { userId, business: 0, noteType: 3, dateType: window === 90 ? 2 : 1, advertiseSwitch: 1 }),
    fansProfile: (userId) => call('kol/data/userId/fans_profile/v1', { userId }),
  }
}

/**
 * Official 开放平台 — same `solar` paths as the web console. The partner docs
 * (ad-market.xiaohongshu.com/docs-center, 蒲公英 tab) are behind login; auth
 * header and base URL are configurable so the path table can be corrected
 * without touching normalize().
 */
function official(token: string, base: string): Gateway {
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` }
  const get = async (path: string, params: Record<string, string | number | undefined> = {}): Promise<Json | null> => {
    const url = new URL(`${base}${path}`)
    for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value))
    const json = await http(url.toString(), { method: 'GET', headers })
    return (json.data as Json | null | undefined) ?? null
  }
  return {
    async list(query, pageNum) {
      const body: Json = {
        searchType: 1,
        column: 'comprehensiverank',
        sort: 'desc',
        pageNum,
        pageSize: PAGE_SIZE,
        keyword: query.keyword ?? '',
        fansNumberLower: query.followersMin ?? null,
        fansNumberUpper: query.followersMax ?? null,
        location: query.region ?? '',
        excludeLowActive: wantsLowActiveExcluded(query),
        cpc: false,
      }
      if (process.env.PGY_BRAND_USER_ID) body.brandUserId = process.env.PGY_BRAND_USER_ID
      if (query.category) body.contentTag = [query.category]
      if (query.priceMin != null || query.priceMax != null) body.estimatePicReadPrice = [query.priceMin ?? 0, query.priceMax ?? -1]
      const json = await http(`${base}/api/solar/cooperator/blogger/v2`, { method: 'POST', headers, body: JSON.stringify(body) })
      return (json.data as Json | null | undefined) ?? null
    },
    detail: (userId) => get(`/api/solar/cooperator/user/blogger/${encodeURIComponent(userId)}`),
    dataSummary: (userId) => get('/api/solar/kol/dataV3/dataSummary', { userId, business: 0 }),
    fansSummary: (userId) => get('/api/solar/kol/dataV3/fansSummary', { userId }),
    notesRate: (userId, window) =>
      get('/api/solar/kol/dataV3/notesRate', { userId, business: 0, noteType: 3, dateType: window === 90 ? 2 : 1, advertiseSwitch: 1 }),
    fansProfile: (userId) => get(`/api/solar/kol/data/${encodeURIComponent(userId)}/fans_profile`),
  }
}

const GATEWAY_BASE: Record<PgyGateway, string> = {
  official: 'https://ad-market.xiaohongshu.com',
  tikhub: 'https://api.tikhub.io',
  justoneapi: 'https://api.justoneapi.com',
}

export function resolveGateway(): { name: PgyGateway; gateway: Gateway } | null {
  const token = process.env.PGY_ACCESS_TOKEN
  if (!token) return null
  const name = (process.env.PGY_GATEWAY || 'tikhub') as PgyGateway
  const base = (process.env.PGY_BASE_URL || GATEWAY_BASE[name] || GATEWAY_BASE.tikhub).replace(/\/$/, '')
  if (name === 'justoneapi') return { name, gateway: justoneapi(token, base) }
  if (name === 'official') return { name, gateway: official(token, base) }
  return { name: 'tikhub', gateway: tikhub(token, base) }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function enrich(gateway: Gateway, userId: string, window: SourceQuery['window'], base: Json): Promise<Json> {
  const settle = async (p: Promise<Json | null>) => {
    try {
      return await p
    } catch {
      return null
    }
  }
  const [dataSummary, fansSummary, notesRate, fansProfile] = await Promise.all([
    settle(gateway.dataSummary(userId)),
    settle(gateway.fansSummary(userId)),
    settle(gateway.notesRate(userId, window)),
    settle(gateway.fansProfile(userId)),
  ])
  // notesRate carries no dateType back, so remember which window we asked for.
  return { ...base, dataSummary, fansSummary, notesRate, fansProfile, kcsWindow: window }
}

function toRecord(payload: Json, fetchedAt: string): RawRecord {
  return { source: 'pugongying', platform: 'xhs', externalId: String(payload.userId ?? ''), fetchedAt, payload }
}

async function fetchLive(query: SourceQuery, gateway: Gateway): Promise<AdapterPage> {
  const fetchedAt = new Date().toISOString()
  if (query.externalIds?.length) {
    const ids = query.externalIds.slice(0, query.limit ?? query.externalIds.length)
    const records: RawRecord[] = []
    for (const userId of ids) {
      const detail = await gateway.detail(userId)
      if (!detail) continue
      records.push(toRecord(await enrich(gateway, userId, query.window, detail), fetchedAt))
    }
    return { sourceMode: 'live', records, nextCursor: null }
  }

  const pageNum = Math.max(1, Number(query.cursor) || 1)
  const data = await gateway.list(query, pageNum)
  let kols = Array.isArray(data?.kols) ? (data!.kols as Json[]) : []
  if (query.limit) kols = kols.slice(0, Math.max(0, query.limit))
  const shouldEnrich = process.env.PGY_ENRICH === '1'
  const records: RawRecord[] = []
  for (const kol of kols) {
    const userId = String(kol.userId ?? '')
    if (!userId) continue
    records.push(toRecord(shouldEnrich ? await enrich(gateway, userId, query.window, kol) : kol, fetchedAt))
  }
  // `total` on the 找博主 list is a paging ceiling (5000), not a hit count.
  const hasMore = kols.length === PAGE_SIZE && pageNum < 250
  return { sourceMode: 'live', records, nextCursor: hasMore ? String(pageNum + 1) : null }
}

// ---------------------------------------------------------------------------
// Normalize
// ---------------------------------------------------------------------------

/** First usable value among paths; a placeholder ("-", "暂无") counts as missing. */
function pick(payload: Json, paths: readonly string[]): unknown {
  for (const path of paths) {
    const value = pickPath(payload, path)
    if (value !== undefined && value !== null && value !== '' && !isPlaceholder(value)) return value
  }
  return undefined
}

function positive(payload: Json, paths: readonly string[]): number | null {
  for (const path of paths) {
    const n = toNumber(pickPath(payload, path))
    if (n != null && n > 0) return n
  }
  return null
}

/** Same as `positive`, for whole-number counts (rounded, within the integer column). */
function positiveCount(payload: Json, paths: readonly string[]): number | null {
  for (const path of paths) {
    const n = toCount(pickPath(payload, path)).value
    if (n != null && n > 0) return n
  }
  return null
}

/** 蒲公英 percent strings ("4.2" = 4.2%) → ratio. */
function percent(payload: Json, paths: readonly string[]): number | null {
  const value = pick(payload, paths)
  if (value === undefined) return null
  return toRatio(value, true)
}

/** Fractions already in 0..1 (pagePercentVo, fans_profile). */
function fraction(payload: Json, paths: readonly string[]): number | null {
  const value = pick(payload, paths)
  return value === undefined ? null : toNumber(value)
}

function healthOf(payload: Json): HealthGrade | null {
  const lowActive = payload.lowActive
  if (lowActive === true) return 'abnormal'
  if (lowActive === false) {
    const active = pickPath(payload, 'dataSummary.isActive')
    return active === false ? 'normal' : 'excellent'
  }
  return null
}

function verticalsOf(payload: Json): string[] {
  const out = new Set<string>()
  const contentTags = payload.contentTags
  if (Array.isArray(contentTags)) {
    for (const tag of contentTags) {
      if (typeof tag === 'string') out.add(tag.trim())
      else if (tag && typeof tag === 'object') {
        const t1 = (tag as Json).taxonomy1Tag
        if (typeof t1 === 'string' && t1) out.add(t1)
        const t2 = (tag as Json).taxonomy2Tags
        if (Array.isArray(t2)) for (const s of t2) if (typeof s === 'string' && s) out.add(s)
      }
    }
  }
  const noteType = pickPath(payload, 'dataSummary.noteType')
  if (Array.isArray(noteType)) {
    for (const item of noteType) {
      const tag = (item as Json)?.contentTag
      if (typeof tag === 'string' && tag) out.add(tag)
    }
  }
  const featureTags = payload.featureTags
  if (Array.isArray(featureTags)) for (const s of featureTags) if (typeof s === 'string' && s) out.add(s.trim())
  return [...out].filter(Boolean)
}

function regionsOf(payload: Json): string[] {
  const location = payload.location
  if (typeof location !== 'string' || !location.trim()) return []
  return location.split(/\s+/).map((s) => s.trim()).filter(Boolean)
}

function audienceOf(payload: Json): AudienceProfile | null {
  const profile = payload.fansProfile as Json | null | undefined
  if (!profile || typeof profile !== 'object') return null
  const list = (value: unknown, nameKey: string) =>
    Array.isArray(value)
      ? value
          .map((item) => ({ name: String((item as Json)[nameKey] ?? ''), ratio: toNumber((item as Json).percent) ?? 0 }))
          .filter((item) => item.name)
      : []
  return {
    femaleRatio: toNumber(pickPath(profile, 'gender.female')),
    ageBands: list(profile.ages, 'group').map(({ name, ratio }) => ({ band: name, ratio })),
    topRegions: list(profile.provinces, 'name'),
    interests: list(profile.interests, 'name'),
  }
}

export function normalizePugongying(raw: RawRecord): NormalizeResult {
  const p = raw.payload
  const externalId = String(p.userId ?? raw.externalId ?? '').trim()
  const displayName = String(p.name ?? '').trim()
  if (!externalId || !displayName) return { ok: false, errors: [!externalId ? 'externalId.missing' : 'displayName.missing'] }

  const m: CreatorMetrics = emptyMetrics(toNumber(p.kcsWindow) === 90 ? 90 : 30)
  m.followers = positiveCount(p, ['fansNum', 'fansCount', 'fansSummary.fansNum'])
  m.followerGrowth = toCount(pick(p, ['fansSummary.fansIncreaseNum', 'fans30GrowthNum']), { signed: true }).value
  m.followerGrowthRate = percent(p, ['fansSummary.fansGrowthRate', 'fans30GrowthRate', 'dataSummary.fans30GrowthRate'])
  m.readFanRatio = percent(p, ['fansSummary.readFansRate'])
  m.activeFanRatio = percent(p, ['fansSummary.activeFansRate'])
  m.engagedFanRatio = percent(p, ['fansSummary.engageFansRate'])

  m.impressionMedian = positiveCount(p, ['notesRate.impMedian', 'dataSummary.mAccumImpNum', 'accumCommonImpMedinNum30d'])
  m.readMedian = positiveCount(p, ['notesRate.readMedian', 'dataSummary.readMedian', 'clickMidNum'])
  m.interactionMedian = positiveCount(p, ['notesRate.interactionMedian', 'dataSummary.interactionMedian', 'interMidNum', 'mEngagementNum'])
  m.likeMedian = positiveCount(p, ['notesRate.likeMedian'])
  m.collectMedian = positiveCount(p, ['notesRate.collectMedian'])
  m.commentMedian = positiveCount(p, ['notesRate.commentMedian'])
  m.coopReadMedian = positiveCount(p, ['readMidCoop30'])
  m.coopInteractionMedian = positiveCount(p, ['interMidCoop30'])
  m.engagementRate = percent(p, ['notesRate.interactionRate'])
  m.retentionRate = percent(p, ['notesRate.videoFullViewRate', 'videoFinishRate'])
  m.noteCount = positiveCount(p, ['notesRate.noteNumber', 'dataSummary.noteNumber'])
  // 千赞笔记比例 is the platform's own "爆文" ratio; no absolute count is exposed.
  m.viralRate = percent(p, ['notesRate.thousandLikePercent', 'thousandLikePercent30'])

  m.priceImage = positive(p, ['picturePrice'])
  m.priceVideo = positive(p, ['videoPrice'])
  m.cpv = positive(p, ['pictureReadCost', 'dataSummary.picReadCost'])
  m.cpe = positive(p, ['estimatePictureEngageCost', 'dataSummary.estimatePictureEngageCost'])
  m.cpm = positive(p, ['estimatePictureCpm', 'dataSummary.estimatePictureCpm'])

  m.trafficSearchRatio = fraction(p, ['notesRate.pagePercentVo.readSearchPercent'])
  m.trafficRecommendRatio = fraction(p, ['notesRate.pagePercentVo.readHomefeedPercent'])
  m.trafficFollowRatio = fraction(p, ['notesRate.pagePercentVo.readFollowPercent'])

  m.health = healthOf(p)
  m.coopNoteCount = positiveCount(p, ['coopNoteNum30d', 'businessNoteCount'])
  m.audience = audienceOf(p)

  const metrics = deriveMetrics(m)
  const warnings = (['followers', 'readMedian', 'interactionMedian', 'priceImage', 'cpe', 'health'] as const)
    .filter((key) => metrics[key] == null)
    .map((key) => `${key}.missing`)

  return {
    ok: true,
    creator: {
      creatorKey: creatorKeyFor('pugongying', externalId),
      externalId,
      platform: 'xhs',
      displayName,
      xhsId: String(p.redId ?? '') || null,
      avatarUrl: String(p.headPhoto ?? '') || null,
      regions: regionsOf(p),
      verticals: verticalsOf(p),
      metrics,
      warnings,
    },
  }
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const pugongyingAdapter: SourceAdapter = {
  id: 'pugongying',
  supports: ['window', 'keyword', 'category', 'region', 'followersMin', 'followersMax', 'priceMin', 'priceMax', 'health', 'externalIds', 'cursor', 'limit'],
  provides: [
    'followers', 'followerGrowth', 'followerGrowthRate', 'readFanRatio', 'activeFanRatio', 'engagedFanRatio',
    'impressionMedian', 'readMedian', 'interactionMedian', 'likeMedian', 'collectMedian', 'commentMedian',
    'coopReadMedian', 'coopInteractionMedian', 'engagementRate', 'retentionRate', 'noteCount', 'viralRate',
    'priceImage', 'priceVideo', 'cpv', 'cpe', 'cpm', 'collectLikeRatio', 'readToFollowerRatio',
    'trafficSearchRatio', 'trafficRecommendRatio', 'trafficFollowRatio', 'health', 'coopNoteCount', 'audience',
  ],
  async fetch(query: SourceQuery): Promise<AdapterPage> {
    const resolved = resolveGateway()
    if (!resolved) {
      const page = fixturePage('pugongying', new URL('./fixtures/pugongying.json', import.meta.url), query)
      return filterFixturePage(page, query, normalizePugongying)
    }
    return fetchLive(query, resolved.gateway)
  },
  normalize: normalizePugongying,
}
