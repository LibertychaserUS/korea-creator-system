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
 *   笔记表现 GET  /api/solar/kol/dataV3/notesRate?userId&business=0&noteType=3&dateType=…&advertiseSwitch=1
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
  emptySignals,
  healthFromLevel,
  PLATFORM_RANK_KEYS,
  SHARE_METRIC_KEYS,
  isPlaceholder,
  normalizeXhsId,
  parseRatio,
  pickPath,
  toCount,
  toNumber,
  type AudienceProfile,
  type CreatorMetrics,
  type FetchContext,
  type NormalizeResult,
  type NumericMetricKey,
  type PgyGateway,
  type PlatformRankKey,
  type RatioUnit,
  type RawRecord,
  type SourceAdapter,
  type SourceQuery,
  type SourceSignals,
  type VendorNote,
} from '@kcs/contract'
import { billedCall, isMeterStop, isVendorInnerError, requestIdOf, VendorInnerError } from './billing'
import { filterFixturePage, fixturePage, type AdapterPage } from './common'

type Json = Record<string, unknown>

const PAGE_SIZE = 20
/**
 * How long one 蒲公英 call may take. TikHub relays to the platform and can be
 * slow; a request that times out may still be billed, so the default is
 * generous (60 s) rather than a quick retry. `PGY_TIMEOUT_MS` overrides.
 */
export function pgyTimeoutMs(source: NodeJS.ProcessEnv = process.env): number {
  const n = Number(source.PGY_TIMEOUT_MS)
  return source.PGY_TIMEOUT_MS && Number.isFinite(n) && n >= 100 ? Math.round(n) : 60_000
}

const text = (value: unknown): string | null => (value == null || value === '' ? null : String(value))

/** TikHub's two layers: outer `{code: 200, request_id, data}`, inner 蒲公英 `{code: 0, success, msg, data}`. */
function readTikhub(json: Json): { value: Reply; empty: boolean } {
  const requestId = requestIdOf(json)
  if (json.code != null && Number(json.code) !== 200) {
    throw new VendorInnerError('pugongying', String(json.code), text(json.message ?? json.message_zh), requestId)
  }
  const envelope = json.data as Json | null | undefined
  if (envelope && typeof envelope === 'object') {
    const code = envelope.code
    const failed = envelope.success === false || (envelope.success !== true && code != null && ![0, 200].includes(Number(code)))
    if (failed) throw new VendorInnerError('pugongying', text(code), text(envelope.msg ?? envelope.message), requestId)
  }
  const data = (envelope?.data as Json | null | undefined) ?? null
  const empty = isEmptyData(data)
  return { value: { data, empty, requestId }, empty }
}

/** One-layer gateways (JustOneAPI, official): the data object sits at `data`. */
function readFlat(json: Json): { value: Reply; empty: boolean } {
  const data = (json.data as Json | null | undefined) ?? null
  const empty = isEmptyData(data)
  return { value: { data, empty, requestId: requestIdOf(json) }, empty }
}

// ---------------------------------------------------------------------------
// Gateways
// ---------------------------------------------------------------------------

/** One answer: the `solar` data object, whether it was empty (billed all the same), and the vendor's request id. */
type Reply = { data: Json | null; empty: boolean; requestId: string | null }

type Gateway = {
  list(query: SourceQuery, pageNum: number): Promise<Reply>
  detail(userId: string): Promise<Reply>
  dataSummary(userId: string): Promise<Reply>
  fansSummary(userId: string): Promise<Reply>
  notesRate(userId: string, dateType: DateType): Promise<Reply>
  fansProfile(userId: string): Promise<Reply>
}

type DateType = number | string

/**
 * notesRate `dateType` per window, as the gateway docs give it: 1 = 30 天,
 * 2 = 90 天 (3 is rejected with 422), and TikHub / official relay the solar
 * value unchanged; JustOneAPI takes string enums. None of this has been checked
 * against a live account yet (待实测: same creator, dateType 1/2, compare
 * noteNumber), so `PGY_DATE_TYPES` (JSON, e.g. `{"30":1,"90":2}`) overrides the
 * table and the value actually sent is stored in the payload as `kcsDateType`.
 */
export const PGY_DATE_TYPES: Record<PgyGateway, Record<SourceQuery['window'], DateType>> = {
  official: { 30: 1, 90: 2 },
  tikhub: { 30: 1, 90: 2 },
  justoneapi: { 30: 'DAY_30', 90: 'DAY_90' },
}

export function dateTypeFor(gateway: PgyGateway, window: SourceQuery['window']): DateType {
  const raw = process.env.PGY_DATE_TYPES
  if (raw) {
    try {
      const override = JSON.parse(raw) as Record<string, unknown>
      const value = override[String(window)]
      if (typeof value === 'number' || (typeof value === 'string' && value)) return value
    } catch {
      // A broken override falls back to the documented table.
    }
  }
  return PGY_DATE_TYPES[gateway][window]
}

/** Nothing to read: `data: null`, `{}`, or a list page without a single kol. Billed all the same. */
function isEmptyData(data: Json | null): boolean {
  if (data == null || typeof data !== 'object') return true
  if (Array.isArray(data.kols)) return data.kols.length === 0
  return Object.keys(data).length === 0
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
function tikhub(token: string, base: string, context?: FetchContext): Gateway {
  const call = async (path: string, body: Json): Promise<Reply> => {
    const route = `/api/v1/xiaohongshu/pgy/${path}`
    const { value } = await billedCall(context, {
      source: 'pugongying',
      endpoint: `tikhub:${route}`,
      url: `${base}${route}`,
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      },
      rule: 'tikhub',
      timeoutMs: pgyTimeoutMs(),
      read: readTikhub,
    })
    return value
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
    notesRate: (userId, dateType) =>
      call('get_blogger_notes_rate', { user_id: userId, business: 0, note_type: 3, date_type: dateType, advertise_switch: 1 }),
    fansProfile: (userId) => call('get_blogger_fans_profile', { user_id: userId }),
  }
}

/** JustOneAPI — GET with `token` query param, payload one layer deep (`data`). */
function justoneapi(token: string, base: string, context?: FetchContext): Gateway {
  const call = async (path: string, params: Record<string, string | number | boolean | undefined>): Promise<Reply> => {
    const route = `/api/xiaohongshu-pgy/api/solar/${path}`
    const url = new URL(`${base}${route}`)
    url.searchParams.set('token', token)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
    const { value } = await billedCall(context, {
      source: 'pugongying',
      endpoint: `justoneapi:${route}`,
      url: url.toString(),
      init: { method: 'GET' },
      rule: 'every-response',
      timeoutMs: pgyTimeoutMs(),
      read: readFlat,
    })
    return value
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
    notesRate: (userId, dateType) =>
      call('kol/dataV3/notesRate/v1', { userId, business: 0, noteType: 3, dateType, advertiseSwitch: 1 }),
    fansProfile: (userId) => call('kol/data/userId/fans_profile/v1', { userId }),
  }
}

/**
 * Official 开放平台 — same `solar` paths as the web console. The partner docs
 * (ad-market.xiaohongshu.com/docs-center, 蒲公英 tab) are behind login; auth
 * header and base URL are configurable so the path table can be corrected
 * without touching normalize().
 */
function official(token: string, base: string, context?: FetchContext): Gateway {
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` }
  const send = async (path: string, url: string, init: RequestInit): Promise<Reply> => {
    const { value } = await billedCall(context, {
      source: 'pugongying',
      endpoint: `official:${path.replace(/\/[0-9a-zA-Z]{16,}(?=\/|$)/g, '/:userId')}`,
      url,
      init,
      rule: 'every-response',
      timeoutMs: pgyTimeoutMs(),
      read: readFlat,
    })
    return value
  }
  const get = async (path: string, params: Record<string, string | number | undefined> = {}): Promise<Reply> => {
    const url = new URL(`${base}${path}`)
    for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value))
    return send(path, url.toString(), { method: 'GET', headers })
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
      const path = '/api/solar/cooperator/blogger/v2'
      return send(path, `${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
    },
    detail: (userId) => get(`/api/solar/cooperator/user/blogger/${encodeURIComponent(userId)}`),
    dataSummary: (userId) => get('/api/solar/kol/dataV3/dataSummary', { userId, business: 0 }),
    fansSummary: (userId) => get('/api/solar/kol/dataV3/fansSummary', { userId }),
    notesRate: (userId, dateType) =>
      get('/api/solar/kol/dataV3/notesRate', { userId, business: 0, noteType: 3, dateType, advertiseSwitch: 1 }),
    fansProfile: (userId) => get(`/api/solar/kol/data/${encodeURIComponent(userId)}/fans_profile`),
  }
}

const GATEWAY_BASE: Record<PgyGateway, string> = {
  official: 'https://ad-market.xiaohongshu.com',
  tikhub: 'https://api.tikhub.io',
  justoneapi: 'https://api.justoneapi.com',
}

type ResolvedGateway = { name: PgyGateway; gateway: Gateway }

export function resolveGateway(context?: FetchContext): ResolvedGateway | null {
  const token = process.env.PGY_ACCESS_TOKEN
  if (!token) return null
  const name = (process.env.PGY_GATEWAY || 'tikhub') as PgyGateway
  const base = (process.env.PGY_BASE_URL || GATEWAY_BASE[name] || GATEWAY_BASE.tikhub).replace(/\/$/, '')
  if (name === 'justoneapi') return { name, gateway: justoneapi(token, base, context) }
  if (name === 'official') return { name, gateway: official(token, base, context) }
  return { name: 'tikhub', gateway: tikhub(token, base, context) }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

const SECTIONS = ['dataSummary', 'fansSummary', 'notesRate', 'fansProfile'] as const
type Section = (typeof SECTIONS)[number]

function note(kind: VendorNote['kind'], endpoint: string, externalId: string | null, reply: Partial<Reply> & { code?: string | null; message?: string | null }): VendorNote {
  return { kind, endpoint, externalId, code: reply.code ?? null, message: reply.message ?? null, requestId: reply.requestId ?? null }
}

/**
 * The four data sections for one creator, one call each. An empty section is
 * kept as `null` and listed in `kcsEmpty`; a section the vendor refused inside
 * a 200 (billed, would fail again) is listed in `kcsIssues` — both surface as
 * warnings on the creator and as notes on the job. Anything else (timeout,
 * 429, 5xx, the meter) ends the page here, so the creator is fetched again
 * whole on the next run rather than stored with a hole nobody sees.
 */
async function enrich(
  resolved: ResolvedGateway,
  userId: string,
  window: SourceQuery['window'],
  base: Json,
  notes: VendorNote[],
): Promise<Json> {
  const { gateway } = resolved
  const dateType = dateTypeFor(resolved.name, window)
  const request: Record<Section, () => Promise<Reply>> = {
    dataSummary: () => gateway.dataSummary(userId),
    fansSummary: () => gateway.fansSummary(userId),
    notesRate: () => gateway.notesRate(userId, dateType),
    fansProfile: () => gateway.fansProfile(userId),
  }
  // notesRate carries no dateType back, so remember what we asked for; if the
  // table above turns out wrong, stored payloads can still be re-read correctly.
  const out: Json = { ...base, kcsWindow: window, kcsDateType: dateType }
  const empty: Section[] = []
  const issues: Json[] = []
  for (const section of SECTIONS) {
    try {
      const reply = await request[section]()
      out[section] = reply.data
      if (reply.empty) {
        empty.push(section)
        notes.push(note('empty', section, userId, reply))
      }
    } catch (error) {
      if (!isVendorInnerError(error)) throw error
      out[section] = null
      issues.push({ section, code: error.code, message: error.detail, requestId: error.requestId })
      notes.push(note('innerError', section, userId, { code: error.code, message: error.detail, requestId: error.requestId }))
    }
  }
  if (empty.length) out.kcsEmpty = empty
  if (issues.length) out.kcsIssues = issues
  return out
}

function toRecord(payload: Json, fetchedAt: string): RawRecord {
  return { source: 'pugongying', platform: 'xhs', externalId: String(payload.userId ?? ''), fetchedAt, payload }
}

/**
 * Where a page resumes. `@<n>` = the n-th id of an `externalIds` refresh;
 * `<page>` or `<page>:<skip>` = a list page, skipping kols already written.
 */
export function parsePgyCursor(cursor: string | null | undefined): { index: number; pageNum: number; skip: number } {
  const text = String(cursor ?? '').trim()
  const at = /^@(\d+)$/.exec(text)
  if (at) return { index: Number(at[1]), pageNum: 1, skip: 0 }
  const page = /^(\d+)(?::(\d+))?$/.exec(text)
  return { index: 0, pageNum: Math.max(1, Number(page?.[1] ?? 1) || 1), skip: Number(page?.[2] ?? 0) }
}

/** A stop mid-page keeps what was fetched (it was paid for) and says where to continue. */
function interrupted(records: RawRecord[], notes: VendorNote[], nextCursor: string, error: unknown): AdapterPage {
  return {
    sourceMode: 'live',
    records,
    nextCursor,
    vendorNotes: notes,
    interrupted: isMeterStop(error) ? { reason: error.reason, resetsAt: error.resetsAt } : { reason: 'error', error },
  }
}

async function fetchPage(query: SourceQuery, resolved: ResolvedGateway): Promise<AdapterPage> {
  const { gateway } = resolved
  const fetchedAt = new Date().toISOString()
  const at = parsePgyCursor(query.cursor)
  if (query.externalIds?.length) {
    const ids = query.externalIds.slice(0, query.limit ?? query.externalIds.length)
    const records: RawRecord[] = []
    const notes: VendorNote[] = []
    for (let i = at.index; i < ids.length; i += 1) {
      const userId = ids[i]!
      try {
        let detail: Reply
        try {
          detail = await gateway.detail(userId)
        } catch (error) {
          // Refused for this one creator (billed); the rest of the list is still worth fetching.
          if (!isVendorInnerError(error)) throw error
          notes.push(note('innerError', 'detail', userId, { code: error.code, message: error.detail, requestId: error.requestId }))
          continue
        }
        // 查无结果: billed and noted; the refresh records the id as not found.
        if (detail.empty || !detail.data) {
          notes.push(note('empty', 'detail', userId, detail))
          continue
        }
        records.push(toRecord(await enrich(resolved, userId, query.window, detail.data, notes), fetchedAt))
      } catch (error) {
        return interrupted(records, notes, `@${i}`, error)
      }
    }
    return { sourceMode: 'live', records, nextCursor: null, vendorNotes: notes }
  }

  const { pageNum, skip } = at
  const list = await gateway.list(query, pageNum)
  const notes: VendorNote[] = []
  if (list.empty) notes.push(note('empty', 'list', null, list))
  let kols = Array.isArray(list.data?.kols) ? (list.data!.kols as Json[]) : []
  if (query.limit) kols = kols.slice(0, Math.max(0, query.limit))
  const shouldEnrich = process.env.PGY_ENRICH === '1'
  const records: RawRecord[] = []
  for (let i = skip; i < kols.length; i += 1) {
    const kol = kols[i]!
    const userId = String(kol.userId ?? '')
    if (!userId) continue
    try {
      records.push(toRecord(shouldEnrich ? await enrich(resolved, userId, query.window, kol, notes) : kol, fetchedAt))
    } catch (error) {
      return interrupted(records, notes, `${pageNum}:${i}`, error)
    }
  }
  // `total` on the 找博主 list is a paging ceiling (5000), not a hit count.
  const hasMore = kols.length === PAGE_SIZE && pageNum < 250
  return { sourceMode: 'live', records, nextCursor: hasMore ? String(pageNum + 1) : null, vendorNotes: notes }
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

/**
 * A ratio metric read with the unit the field is documented in: 蒲公英 writes
 * most rates as percent strings ("4.2" = 4.2%), pagePercentVo and fans_profile
 * as fractions. Unusable values leave a `<key>.<issue>` warning.
 */
function ratioMetric(
  key: NumericMetricKey | 'completionRate' | 'read3sRate',
  payload: Json,
  paths: readonly string[],
  unit: RatioUnit,
  warnings: string[],
): number | null {
  const value = pick(payload, paths)
  if (value === undefined) return null
  const share = key === 'completionRate' || key === 'read3sRate' || SHARE_METRIC_KEYS.includes(key)
  const parsed = parseRatio(value, unit, { share })
  if (parsed.issue) warnings.push(`${key}.${parsed.issue}`)
  return parsed.value
}

function flag(value: unknown): boolean | null {
  if (value === true || value === 1 || value === '1' || value === 'true') return true
  if (value === false || value === 0 || value === '0' || value === 'false') return false
  return null
}

/** 「超过 X% 同类博主」fields; the notesRate one matches the window we asked for. */
const RANK_PATHS: Record<PlatformRankKey, readonly string[]> = {
  impressionMedian: ['notesRate.impMedianBeyondRate'],
  readMedian: ['notesRate.readMedianBeyondRate', 'dataSummary.readMedianBeyondRate'],
  interactionMedian: ['notesRate.interactionMedianBeyondRate'],
  interactionRate: ['notesRate.interactionBeyondRate', 'dataSummary.interactionBeyondRate'],
  followerGrowth: ['fansSummary.fansGrowthBeyondRate'],
  activeFanRatio: ['fansSummary.activeFansBeyondRate'],
  engagedFanRatio: ['fansSummary.engageFansBeyondRate'],
  readFanRatio: ['fansSummary.readFansBeyondRate'],
  completionRate: ['notesRate.videoFullViewBeyondRate'],
}

/**
 * Everything 蒲公英 says that the shared metrics cannot hold as-is. There is
 * no documented 健康等级 field in the solar responses we relay, so
 * `healthLevel` stays null until one is confirmed (待实测); 低活跃 is its own flag.
 */
function signalsOf(p: Json, warnings: string[]): SourceSignals {
  const signals = emptySignals()
  signals.lowActive = flag(p.lowActive)
  signals.recentlyActive = flag(pickPath(p, 'dataSummary.isActive'))
  signals.completionRate = ratioMetric('completionRate', p, ['notesRate.videoFullViewRate', 'videoFinishRate'], 'percent', warnings)
  signals.read3sRate = ratioMetric('read3sRate', p, ['notesRate.picture3sViewRate'], 'percent', warnings)
  signals.coopNoteCountTotal = positiveCount(p, ['businessNoteCount'])
  // 外溢进店: field names from relayed responses, not yet seen on a live account (待实测).
  signals.storeVisitUvMedian = positiveCount(p, ['notesRate.mCpuvNum', 'dataSummary.mCpuvNum', 'mCpuvNum'])
  signals.storeVisitUnitPrice = positive(p, ['notesRate.estimateCpuv', 'dataSummary.estimateCpuv30d', 'estimateCpuv30d', 'estimateCpuv'])
  for (const key of PLATFORM_RANK_KEYS) {
    const value = pick(p, RANK_PATHS[key])
    if (value === undefined) continue
    const parsed = parseRatio(value, 'percent', { share: true })
    if (parsed.issue) warnings.push(`platformRanks.${key}.${parsed.issue}`)
    else if (parsed.value != null) signals.platformRanks[key] = parsed.value
  }
  // Field names carry the window: activeFansL28 / engageFansL30 / readFansIn30.
  if (pickPath(p, 'fansSummary.activeFansRate') != null) signals.windowDays.activeFanRatio = 28
  if (pickPath(p, 'fansSummary.engageFansRate') != null) signals.windowDays.engagedFanRatio = 30
  if (pickPath(p, 'fansSummary.readFansRate') != null) signals.windowDays.readFanRatio = 30
  signals.windowDays.coopNoteCount = 30
  if (signals.storeVisitUvMedian != null || signals.storeVisitUnitPrice != null) signals.windowDays.storeVisit = 30
  return signals
}

/** Platform ranks keyed by the metric they rank (蒲公英's 互动率 rank is our `engagementRate`). */
function metricRanks(ranks: SourceSignals['platformRanks']): CreatorMetrics['platformRanks'] {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(ranks)) {
    if (value != null) out[key === 'interactionRate' ? 'engagementRate' : key] = value
  }
  return Object.keys(out).length ? out : null
}

/**
 * 主要内容形式 from the note mix: video notes ≥ half of all notes → video,
 * otherwise image. 待实测: `videoNoteNumber` is seen in relayed samples only.
 */
function contentFormOf(payload: Json): CreatorMetrics['contentForm'] {
  const notes = positiveCount(payload, ['notesRate.noteNumber', 'dataSummary.noteNumber'])
  const video = toCount(pick(payload, ['notesRate.videoNoteNumber', 'dataSummary.videoNoteNumber'])).value
  if (!notes || video == null || video > notes) return null
  return video / notes >= 0.5 ? 'video' : 'image'
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
  const issues: string[] = []
  const percent = (key: NumericMetricKey, paths: readonly string[]) => ratioMetric(key, p, paths, 'percent', issues)
  const fraction = (key: NumericMetricKey, paths: readonly string[]) => ratioMetric(key, p, paths, 'ratio', issues)
  m.followers = positiveCount(p, ['fansNum', 'fansCount', 'fansSummary.fansNum'])
  m.followerGrowth = toCount(pick(p, ['fansSummary.fansIncreaseNum', 'fans30GrowthNum']), { signed: true }).value
  m.followerGrowthRate = percent('followerGrowthRate', ['fansSummary.fansGrowthRate', 'fans30GrowthRate', 'dataSummary.fans30GrowthRate'])
  m.readFanRatio = percent('readFanRatio', ['fansSummary.readFansRate'])
  m.activeFanRatio = percent('activeFanRatio', ['fansSummary.activeFansRate'])
  m.engagedFanRatio = percent('engagedFanRatio', ['fansSummary.engageFansRate'])

  m.impressionMedian = positiveCount(p, ['notesRate.impMedian', 'dataSummary.mAccumImpNum', 'accumCommonImpMedinNum30d'])
  m.readMedian = positiveCount(p, ['notesRate.readMedian', 'dataSummary.readMedian', 'clickMidNum'])
  m.interactionMedian = positiveCount(p, ['notesRate.interactionMedian', 'dataSummary.interactionMedian', 'interMidNum', 'mEngagementNum'])
  m.likeMedian = positiveCount(p, ['notesRate.likeMedian'])
  m.collectMedian = positiveCount(p, ['notesRate.collectMedian'])
  m.commentMedian = positiveCount(p, ['notesRate.commentMedian'])
  m.coopReadMedian = positiveCount(p, ['readMidCoop30'])
  m.coopInteractionMedian = positiveCount(p, ['interMidCoop30'])
  m.engagementRate = percent('engagementRate', ['notesRate.interactionRate'])
  m.noteCount = positiveCount(p, ['notesRate.noteNumber', 'dataSummary.noteNumber'])
  // 千赞笔记比例 is the platform's own "爆文" ratio; no absolute count is exposed.
  m.viralRate = percent('viralRate', ['notesRate.thousandLikePercent', 'thousandLikePercent30'])

  m.priceImage = positive(p, ['picturePrice'])
  m.priceVideo = positive(p, ['videoPrice'])
  m.cpr = positive(p, ['pictureReadCost', 'dataSummary.picReadCost'])
  m.cpe = positive(p, ['estimatePictureEngageCost', 'dataSummary.estimatePictureEngageCost'])
  m.cpm = positive(p, ['estimatePictureCpm', 'dataSummary.estimatePictureCpm'])

  m.trafficSearchRatio = fraction('trafficSearchRatio', ['notesRate.pagePercentVo.readSearchPercent'])
  m.trafficRecommendRatio = fraction('trafficRecommendRatio', ['notesRate.pagePercentVo.readHomefeedPercent'])
  m.trafficFollowRatio = fraction('trafficFollowRatio', ['notesRate.pagePercentVo.readFollowPercent'])

  const signals = signalsOf(p, issues)
  // No confirmed 健康等级 field yet: unknown stays unknown; 低活跃 is its own flag.
  m.health = healthFromLevel(signals.healthLevel)
  m.lowActive = signals.lowActive
  m.completionRate = signals.completionRate
  m.read3sRate = signals.read3sRate
  m.storeVisitUvMedian = signals.storeVisitUvMedian
  m.storeVisitUnitPrice = signals.storeVisitUnitPrice
  m.platformRanks = metricRanks(signals.platformRanks)
  m.contentForm = contentFormOf(p)
  // Recent window only; the all-time count (businessNoteCount) is signals.coopNoteCountTotal.
  m.coopNoteCount = positiveCount(p, ['coopNoteNum30d'])
  m.audience = audienceOf(p)

  // Sections that came back empty or refused are said out loud, not left as silent blanks.
  if (Array.isArray(p.kcsEmpty)) for (const section of p.kcsEmpty) issues.push(`${String(section)}.empty`)
  if (Array.isArray(p.kcsIssues)) for (const issue of p.kcsIssues) issues.push(`${String((issue as Json)?.section)}.fetchFailed`)

  const metrics = deriveMetrics(m)
  const warnings = (['followers', 'readMedian', 'interactionMedian', 'priceImage', 'cpe'] as const)
    .filter((key) => metrics[key] == null)
    .map((key) => `${key}.missing`)
    .concat(issues)

  return {
    ok: true,
    creator: {
      creatorKey: creatorKeyFor('pugongying', externalId),
      externalId,
      platform: 'xhs',
      displayName,
      xhsId: normalizeXhsId(p.redId),
      avatarUrl: String(p.headPhoto ?? '') || null,
      regions: regionsOf(p),
      verticals: verticalsOf(p),
      metrics,
      signals,
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
    'coopReadMedian', 'coopInteractionMedian', 'engagementRate', 'completionRate', 'read3sRate', 'noteCount', 'viralRate',
    'priceImage', 'priceVideo', 'cpr', 'cpe', 'cpm', 'collectLikeRatio', 'readToFollowerRatio',
    'trafficSearchRatio', 'trafficRecommendRatio', 'trafficFollowRatio', 'storeVisitUvMedian', 'storeVisitUnitPrice',
    'coopNoteCount', 'audience', 'lowActive', 'contentForm', 'platformRanks',
  ],
  metered: true,
  async fetch(query: SourceQuery, context?: FetchContext): Promise<AdapterPage> {
    const resolved = resolveGateway(context)
    if (!resolved) {
      const page = fixturePage('pugongying', new URL('./fixtures/pugongying.json', import.meta.url), query)
      return filterFixturePage(page, query, normalizePugongying)
    }
    return fetchPage(query, resolved)
  },
  normalize: normalizePugongying,
}
