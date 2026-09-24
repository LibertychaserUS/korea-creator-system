/**
 * 蒲公英 adapter.
 *
 * Field names below are the platform's own `solar` schema, confirmed against
 * pgy.xiaohongshu.com responses that TikHub and JustOneAPI relay unchanged:
 *
 *   列表   POST /api/solar/cooperator/blogger/v2               → data.kols[]  (~140 fields per kol)
 *   资料   GET  /api/solar/cooperator/user/blogger/{userId}    → data
 *   数据概览 GET  /api/solar/kol/dataV3/dataSummary?userId&business=0|1
 *   粉丝概览 GET  /api/solar/kol/dataV3/fansSummary?userId
 *   笔记表现 GET  /api/solar/kol/dataV3/notesRate?userId&business=0|1&noteType=3&dateType=…&advertiseSwitch=1|0
 *
 * `business` / `advertiseSwitch` follow the source's scope (日常 / 合作笔记,
 * 全部 / 仅自然流量; `SourceScope`, default 全部流量 · 日常笔记).
 *   粉丝画像 GET  /api/solar/kol/data/{userId}/fans_profile
 *
 * RawRecord.payload is the kol item (or the 资料 object) with the four data
 * responses merged under `dataSummary` / `fansSummary` / `notesRate` /
 * `fansProfile` when enrichment ran. Enrichment costs 4 extra billed calls per
 * creator on paid gateways, so it is on for `externalIds` refreshes and opt-in
 * (`PGY_ENRICH=1`) for searches: a search page is 1 call by default. Scheduled
 * refreshes carry the two slow sections over for a month (3 calls a round).
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
  pgyAccess,
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
  SOURCE_SCOPE_DEFAULTS,
  type SourceAdapter,
  type SourceScope,
  type SourceQuery,
  type SourceSignals,
  type VendorNote,
} from '@kcs/contract'
import { billedCall, isMeterStop, isVendorInnerError, requestIdOf, VendorCodeError, VendorInnerError, type VendorCodeKind } from './billing'
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

/**
 * JustOneAPI answers HTTP 200 and says how it went in the body `code`, per
 * its docs (待实测 against a live token):
 *   0 成功 · 100 token 无效 · 301 / 302 / 500 繁忙或上游异常，稍后再试 ·
 *   303 当日额度用完 · 400 参数错误 · 600 上游拒绝 · 601 / 602 余额不足.
 * A code the table does not know is a refusal like any other inner failure.
 */
export const JUSTONEAPI_CODES: Record<number, VendorCodeKind | 'ok'> = {
  0: 'ok',
  100: 'credential',
  301: 'busy',
  302: 'busy',
  303: 'busy',
  400: 'rejected',
  500: 'busy',
  600: 'rejected',
  601: 'balance',
  602: 'balance',
}

/** JustOneAPI's day resets at 00:00 Asia/Shanghai (UTC+8, no DST); a 303 waits for it. */
export function untilShanghaiMidnight(now = Date.now()): number {
  const day = 86_400_000
  const shifted = now + 8 * 3_600_000
  return day - (shifted % day)
}

function readJustOne(json: Json): { value: Reply; empty: boolean } {
  if (json.code == null) return readFlat(json)
  const code = Number(json.code)
  const kind = Number.isFinite(code) ? JUSTONEAPI_CODES[code] : undefined
  if (kind === 'ok') return readFlat(json)
  const detail = text(json.message ?? json.msg)
  const requestId = requestIdOf(json)
  if (!kind) throw new VendorInnerError('pugongying', String(json.code), detail, requestId)
  throw new VendorCodeError('pugongying', 'justoneapi', kind, String(code), detail, requestId, code === 303 ? untilShanghaiMidnight() : null)
}

// ---------------------------------------------------------------------------
// Gateways
// ---------------------------------------------------------------------------

/** One answer: the `solar` data object, whether it was empty (billed all the same), and the vendor's request id. */
type Reply = { data: Json | null; empty: boolean; requestId: string | null }

type Gateway = {
  list(query: SourceQuery, pageNum: number): Promise<Reply>
  detail(userId: string): Promise<Reply>
  dataSummary(userId: string, scope: SourceScope): Promise<Reply>
  fansSummary(userId: string): Promise<Reply>
  notesRate(userId: string, dateType: DateType, scope: SourceScope): Promise<Reply>
  fansProfile(userId: string): Promise<Reply>
}

type DateType = number | string

/** solar `business` (0 = 日常笔记, 1 = 合作笔记) and `advertiseSwitch` (1 = 全部流量, 0 = 仅自然流量). */
function solarScope(scope: SourceScope): { business: number; advertiseSwitch: number } {
  return { business: scope.business === 'coop' ? 1 : 0, advertiseSwitch: scope.traffic === 'organic' ? 0 : 1 }
}

/** JustOneAPI spells the same switches as string enums (待实测). */
function justOneScope(scope: SourceScope): { business: string; advertiseSwitch: string } {
  return {
    business: scope.business === 'coop' ? 'COOPERATE_NOTE' : 'DAILY_NOTE',
    advertiseSwitch: scope.traffic === 'organic' ? 'ORGANIC_ONLY' : 'ALL',
  }
}

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
      retryOn400: true,
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
    dataSummary: (userId, scope) => call('get_blogger_data_summary', { user_id: userId, business: solarScope(scope).business }),
    fansSummary: (userId) => call('get_blogger_fans_summary', { user_id: userId }),
    notesRate: (userId, dateType, scope) => {
      const { business, advertiseSwitch } = solarScope(scope)
      return call('get_blogger_notes_rate', { user_id: userId, business, note_type: 3, date_type: dateType, advertise_switch: advertiseSwitch })
    },
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
      read: readJustOne,
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
    dataSummary: (userId, scope) => call('kol/dataV3/dataSummary/v1', { userId, business: justOneScope(scope).business }),
    fansSummary: (userId) => call('kol/dataV3/fansSummary/v1', { userId }),
    notesRate: (userId, dateType, scope) =>
      call('kol/dataV3/notesRate/v1', { userId, noteType: 'PHOTO_TEXT_AND_VIDEO', dateType, ...justOneScope(scope) }),
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
    dataSummary: (userId, scope) => get('/api/solar/kol/dataV3/dataSummary', { userId, business: solarScope(scope).business }),
    fansSummary: (userId) => get('/api/solar/kol/dataV3/fansSummary', { userId }),
    notesRate: (userId, dateType, scope) =>
      get('/api/solar/kol/dataV3/notesRate', { userId, noteType: 3, dateType, ...solarScope(scope) }),
    fansProfile: (userId) => get(`/api/solar/kol/data/${encodeURIComponent(userId)}/fans_profile`),
  }
}

type ResolvedGateway = { name: PgyGateway; gateway: Gateway; scope: SourceScope }

export function resolveGateway(context?: FetchContext): ResolvedGateway | null {
  const access = pgyAccess(process.env)
  if (!access) return null
  const { gateway: name, token, baseUrl: base } = access
  const scope = context?.scope ?? SOURCE_SCOPE_DEFAULTS.pugongying!
  if (name === 'justoneapi') return { name, gateway: justoneapi(token, base, context), scope }
  if (name === 'official') return { name, gateway: official(token, base, context), scope }
  return { name: 'tikhub', gateway: tikhub(token, base, context), scope }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

const SECTIONS = ['dataSummary', 'fansSummary', 'notesRate', 'fansProfile'] as const
type Section = (typeof SECTIONS)[number]

/**
 * Fan facts (粉丝概览: fan quality shares; 粉丝画像: demographics) move slowly.
 * A scheduled refresh reuses them while they are younger than
 * `PGY_SLOW_REFRESH_DAYS` (default 30), so a round costs 3 calls (资料 +
 * 数据概览 + 笔记表现) and the other 2 once a month.
 */
const SLOW_SECTIONS: readonly Section[] = ['fansSummary', 'fansProfile']

export function slowRefreshDays(source: NodeJS.ProcessEnv = process.env): number {
  const n = Number(source.PGY_SLOW_REFRESH_DAYS)
  return source.PGY_SLOW_REFRESH_DAYS != null && source.PGY_SLOW_REFRESH_DAYS !== '' && Number.isFinite(n) && n >= 0 ? n : 30
}

type Previous = { payload: Json; fetchedAt: string } | null

/** A slow section from the previous payload that is still fresh enough to keep, with when it was fetched. */
function carried(previous: Previous, section: Section, now: number): { data: unknown; at: string } | null {
  if (!previous || !SLOW_SECTIONS.includes(section)) return null
  const data = previous.payload[section]
  if (data == null) return null
  const missed = [previous.payload.kcsEmpty, (previous.payload.kcsIssues as Json[] | undefined)?.map((issue) => issue.section)]
  if (missed.some((list) => Array.isArray(list) && list.includes(section))) return null
  const stamps = previous.payload.kcsSectionsAt as Record<string, unknown> | undefined
  const at = typeof stamps?.[section] === 'string' ? (stamps[section] as string) : previous.fetchedAt
  const age = now - Date.parse(at)
  return Number.isFinite(age) && age >= 0 && age < slowRefreshDays() * 86_400_000 ? { data, at } : null
}

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
 * `kcsSectionsAt` says when each section was fetched; `kcsCarried` lists the
 * ones taken over from `previous` rather than fetched this time.
 */
async function enrich(
  resolved: ResolvedGateway,
  userId: string,
  window: SourceQuery['window'],
  base: Json,
  notes: VendorNote[],
  previous: Previous = null,
): Promise<Json> {
  const { gateway, scope } = resolved
  const dateType = dateTypeFor(resolved.name, window)
  const request: Record<Section, () => Promise<Reply>> = {
    dataSummary: () => gateway.dataSummary(userId, scope),
    fansSummary: () => gateway.fansSummary(userId),
    notesRate: () => gateway.notesRate(userId, dateType, scope),
    fansProfile: () => gateway.fansProfile(userId),
  }
  // notesRate carries no dateType back, so remember what we asked for; if the
  // table above turns out wrong, stored payloads can still be re-read correctly.
  const out: Json = { ...base, kcsWindow: window, kcsDateType: dateType, kcsScope: { ...scope } }
  const empty: Section[] = []
  const issues: Json[] = []
  const sectionsAt: Partial<Record<Section, string>> = {}
  const carriedOver: Section[] = []
  const now = Date.now()
  for (const section of SECTIONS) {
    const kept = carried(previous, section, now)
    if (kept) {
      out[section] = kept.data
      sectionsAt[section] = kept.at
      carriedOver.push(section)
      continue
    }
    try {
      const reply = await request[section]()
      sectionsAt[section] = new Date().toISOString()
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
  out.kcsSectionsAt = sectionsAt
  if (carriedOver.length) out.kcsCarried = carriedOver
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

async function fetchPage(query: SourceQuery, resolved: ResolvedGateway, context?: FetchContext): Promise<AdapterPage> {
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
        const previous = context?.previous ? await context.previous(userId) : null
        records.push(toRecord(await enrich(resolved, userId, query.window, detail.data, notes, previous as Previous), fetchedAt))
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

/** The 数据概览 ranks are 近 30 天 whatever window was asked for. */
const RANK_PATHS_30D = new Set(['dataSummary.readMedianBeyondRate', 'dataSummary.interactionBeyondRate'])

/**
 * 30-day fallbacks (list fields, 数据概览) for a window-following metric: used
 * on a 30-day record, dropped on a 90-day one — a 90-day row shows only what
 * notesRate returned for dateType 90, never a 30-day number under a 90 label.
 */
type Recent = (paths: readonly string[]) => readonly string[]

/**
 * Everything 蒲公英 says that the shared metrics cannot hold as-is. There is
 * no documented 健康等级 field in the solar responses we relay, so
 * `healthLevel` stays null until one is confirmed (待实测); 低活跃 is its own flag.
 */
function signalsOf(p: Json, warnings: string[], recent: Recent): SourceSignals {
  const signals = emptySignals()
  signals.lowActive = flag(p.lowActive)
  signals.recentlyActive = flag(pickPath(p, 'dataSummary.isActive'))
  signals.completionRate = ratioMetric('completionRate', p, ['notesRate.videoFullViewRate', ...recent(['videoFinishRate'])], 'percent', warnings)
  signals.read3sRate = ratioMetric('read3sRate', p, ['notesRate.picture3sViewRate'], 'percent', warnings)
  // All-time count (the fixture's 241 against coopNoteNum30d = 6); 待实测 on a live account.
  signals.coopNoteCountTotal = positiveCount(p, ['businessNoteCount'])
  // 外溢进店 is a fixed 30-day fact (windowDays.storeVisit); field names from relayed responses (待实测).
  signals.storeVisitUvMedian = positiveCount(p, ['notesRate.mCpuvNum', 'dataSummary.mCpuvNum', 'mCpuvNum30d', 'mCpuvNum'])
  signals.storeVisitUnitPrice = positive(p, ['notesRate.estimateCpuv', 'dataSummary.estimateCpuv30d', 'estimateCpuv30d', 'estimateCpuv'])
  for (const key of PLATFORM_RANK_KEYS) {
    const value = pick(p, RANK_PATHS[key].filter((path) => !RANK_PATHS_30D.has(path) || recent([path]).length))
    if (value === undefined) continue
    const parsed = parseRatio(value, 'percent', { share: true })
    if (parsed.issue) warnings.push(`platformRanks.${key}.${parsed.issue}`)
    else if (parsed.value != null) signals.platformRanks[key] = parsed.value
  }
  // Field names carry the window: activeFansL28 / engageFansL30 / readFansIn30.
  if (pickPath(p, 'fansSummary.activeFansRate') != null) signals.windowDays.activeFanRatio = 28
  if (pickPath(p, 'fansSummary.engageFansRate') != null) signals.windowDays.engagedFanRatio = 30
  if (pickPath(p, 'fansSummary.readFansRate') != null) signals.windowDays.readFanRatio = 30
  if (pick(p, ['fansSummary.fansIncreaseNum', 'fans30GrowthNum', 'fansSummary.fansGrowthRate', 'fans30GrowthRate']) !== undefined) {
    signals.windowDays.followerGrowth = 30
  }
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

/** 爆文数 = 千赞笔记比例 × 笔记数, both from the one notesRate answer (so the same window and scope). */
function viralCountOf(payload: Json): { value: number; basis: string } | null {
  const notes = positiveCount(payload, ['notesRate.noteNumber'])
  const share = pick(payload, ['notesRate.thousandLikePercent'])
  if (!notes || share === undefined) return null
  const parsed = parseRatio(share, 'percent', { share: true })
  if (parsed.value == null) return null
  return { value: Math.round(parsed.value * notes), basis: 'notesRate.thousandLikePercent*noteNumber' }
}

function scopeOf(value: unknown): SourceScope | null {
  if (!value || typeof value !== 'object') return null
  const { traffic, business } = value as Json
  if ((traffic !== 'all' && traffic !== 'organic') || (business !== 'daily' && business !== 'coop')) return null
  return { traffic, business }
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

  const window = toNumber(p.kcsWindow) === 90 ? 90 : 30
  const recent: Recent = (paths) => (window === 30 ? paths : [])
  const m: CreatorMetrics = emptyMetrics(window)
  const issues: string[] = []
  const percent = (key: NumericMetricKey, paths: readonly string[]) => ratioMetric(key, p, paths, 'percent', issues)
  const fraction = (key: NumericMetricKey, paths: readonly string[]) => ratioMetric(key, p, paths, 'ratio', issues)
  // Fan facts have their own fixed window (windowDays), whatever window the notes were read for.
  m.followers = positiveCount(p, ['fansNum', 'fansCount', 'fansSummary.fansNum'])
  m.followerGrowth = toCount(pick(p, ['fansSummary.fansIncreaseNum', 'fans30GrowthNum']), { signed: true }).value
  m.followerGrowthRate = percent('followerGrowthRate', ['fansSummary.fansGrowthRate', 'fans30GrowthRate', 'dataSummary.fans30GrowthRate'])
  m.readFanRatio = percent('readFanRatio', ['fansSummary.readFansRate'])
  m.activeFanRatio = percent('activeFanRatio', ['fansSummary.activeFansRate'])
  m.engagedFanRatio = percent('engagedFanRatio', ['fansSummary.engageFansRate'])

  m.impressionMedian = positiveCount(p, ['notesRate.impMedian', ...recent(['dataSummary.mAccumImpNum', 'accumCommonImpMedinNum30d'])])
  m.readMedian = positiveCount(p, ['notesRate.readMedian', ...recent(['dataSummary.readMedian', 'clickMidNum'])])
  m.interactionMedian = positiveCount(p, ['notesRate.interactionMedian', ...recent(['dataSummary.interactionMedian', 'interMidNum', 'mEngagementNum'])])
  m.likeMedian = positiveCount(p, ['notesRate.likeMedian'])
  m.collectMedian = positiveCount(p, ['notesRate.collectMedian'])
  m.commentMedian = positiveCount(p, ['notesRate.commentMedian'])
  m.coopReadMedian = positiveCount(p, recent(['readMidCoop30']))
  m.coopInteractionMedian = positiveCount(p, recent(['interMidCoop30']))
  m.engagementRate = percent('engagementRate', ['notesRate.interactionRate'])
  m.noteCount = positiveCount(p, ['notesRate.noteNumber', ...recent(['dataSummary.noteNumber'])])
  // 千赞笔记比例 is the platform's own "爆文" ratio; the count is read back from the same notesRate answer.
  m.viralRate = percent('viralRate', ['notesRate.thousandLikePercent', ...recent(['thousandLikePercent30'])])
  const viral = viralCountOf(p)
  if (viral) {
    m.viralCount = viral.value
    m.basis.viralCount = viral.basis
  }

  m.priceImage = positive(p, ['picturePrice'])
  m.priceVideo = positive(p, ['videoPrice'])
  // The platform's own unit-cost estimates are 近 30 天; a 90-day row derives them from its own medians.
  m.cpr = positive(p, recent(['pictureReadCost', 'dataSummary.picReadCost']))
  m.cpe = positive(p, recent(['estimatePictureEngageCost', 'dataSummary.estimatePictureEngageCost']))
  m.cpeVideo = positive(p, recent(['estimateVideoEngageCost', 'dataSummary.estimateVideoEngageCost']))
  m.cpm = positive(p, recent(['estimatePictureCpm', 'dataSummary.estimatePictureCpm']))

  m.trafficSearchRatio = fraction('trafficSearchRatio', ['notesRate.pagePercentVo.readSearchPercent'])
  m.trafficRecommendRatio = fraction('trafficRecommendRatio', ['notesRate.pagePercentVo.readHomefeedPercent'])
  m.trafficFollowRatio = fraction('trafficFollowRatio', ['notesRate.pagePercentVo.readFollowPercent'])

  const signals = signalsOf(p, issues, recent)
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
  const scope = scopeOf(p.kcsScope)
  if (scope) {
    m.basis.trafficScope = scope.traffic
    m.basis.businessScope = scope.business
  }
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
    'coopReadMedian', 'coopInteractionMedian', 'engagementRate', 'completionRate', 'read3sRate', 'noteCount', 'viralCount', 'viralRate',
    'priceImage', 'priceVideo', 'cpr', 'cpe', 'cpeVideo', 'cpm', 'collectLikeRatio', 'readToFollowerRatio',
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
    return fetchPage(query, resolved, context)
  },
  normalize: normalizePugongying,
}
