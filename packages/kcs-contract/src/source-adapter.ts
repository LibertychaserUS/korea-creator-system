/**
 * SourceAdapter — the system is a parameterised crawler with a transform layer.
 *
 *   SourceQuery (crawler params) → adapter.fetch → RawRecord[] (platform JSON, stored verbatim)
 *   RawRecord → adapter.normalize → NormalizedCreator (identity + CreatorMetrics)
 *
 * Route A = 蒲公英 (official platform data; reachable through the official
 * OpenAPI or through paid API gateways that proxy the same `solar` JSON).
 * Route B = third-party data vendors (千瓜 / 新红).
 * Self-built scraping (route C) is deliberately not a source.
 */
import type { CreatorMetrics, MetricWindow, HealthGrade, NumericMetricKey, Platform } from './metrics'
import type { FetchContext, PageInterruption, VendorNote } from './billing'

export const SOURCE_IDS = ['pugongying', 'qiangua', 'xinhong'] as const
export type SourceId = (typeof SOURCE_IDS)[number]

export const SOURCE_ROUTE: Record<SourceId, 'official' | 'vendor'> = {
  pugongying: 'official',
  qiangua: 'vendor',
  xinhong: 'vendor',
}

/**
 * The `ingest_sources` row each source starts with. Migration 0008 writes the
 * same values for a fresh install; the queue registers a missing one from here.
 * Ops may rename or re-limit a source later — nothing overwrites that.
 */
/** Vendors reset their daily call quota at midnight in this zone. */
export const DEFAULT_QUOTA_TIME_ZONE = 'Asia/Shanghai'

/**
 * `dailyBudgetUsd` caps what one quota day may cost (see `VENDOR_PRICES_USD`);
 * `null` = no money cap, only the call quota. 蒲公英 via TikHub starts at $5
 * (250 calls at $0.02): enough for a day of list pages and a few dozen
 * detail refreshes, small enough that a mistake costs little.
 */
export const SOURCE_DEFAULTS: Record<SourceId, { name: string; shortName: string; rateLimit: number; quota: number; dailyBudgetUsd: number | null }> = {
  pugongying: { name: '蒲公英 OpenAPI', shortName: '蒲公英', rateLimit: 60, quota: 1000, dailyBudgetUsd: 5 },
  qiangua: { name: '千瓜', shortName: '千瓜', rateLimit: 60, quota: 1000, dailyBudgetUsd: null },
  xinhong: { name: '新红', shortName: '新红', rateLimit: 60, quota: 1000, dailyBudgetUsd: null },
}

/** Env override of a source's daily money budget (USD), read before `ingest_sources.daily_budget_usd`. */
export const SOURCE_BUDGET_ENV: Record<SourceId, string> = {
  pugongying: 'PGY_DAILY_BUDGET_USD',
  qiangua: 'QIANGUA_DAILY_BUDGET_USD',
  xinhong: 'XINHONG_DAILY_BUDGET_USD',
}

/**
 * Which notes and which traffic a source's numbers describe (蒲公英 `business`
 * and `advertise_switch`). The two switches drive two different families:
 *
 * - `traffic` → 传播类 (曝光 / 阅读 / 互动中位数, 互动率 …, from 笔记表现
 *   `advertise_switch`): `organic` = 仅自然流量, `all` = 全部流量 including paid
 *   boosts. Reach is always read on 日常笔记 (`REACH_BUSINESS_SCOPE`).
 * - `business` → 成本类 (CPE, CPM, 阅读单价 …, from 数据概览 `business`):
 *   `coop` = 合作笔记, `daily` = 日常笔记. A creator with no 合作笔记 data falls
 *   back to 日常笔记, and `metrics.basis` says so (`businessScope: 'daily'`,
 *   `costFallback: 'noCoopData'`).
 *
 * Defaults (待实测 against a live account): reach on organic traffic — the
 * creator's own pull, not what a brand paid to boost — and cost on 合作笔记,
 * closest to what a brand gets from a paid post. A 全部流量 reference is
 * fetched about once a month (`PGY_ALL_TRAFFIC_REFERENCE_DAYS`) and shown for
 * comparison only (`metrics.allTraffic`). Sources without such switches have
 * `null` defaults. The scope a record was fetched with is kept in its payload
 * (`kcsScope`) and in `metrics.basis.trafficScope` / `businessScope`.
 */
export const TRAFFIC_SCOPES = ['all', 'organic'] as const
export type TrafficScope = (typeof TRAFFIC_SCOPES)[number]
export const BUSINESS_SCOPES = ['daily', 'coop'] as const
export type BusinessScope = (typeof BUSINESS_SCOPES)[number]
export type SourceScope = { traffic: TrafficScope; business: BusinessScope }
export type SourceScopeView = SourceScope & { from: { traffic: 'env' | 'source' | 'default'; business: 'env' | 'source' | 'default' } }

export const SOURCE_SCOPE_DEFAULTS: Record<SourceId, SourceScope | null> = {
  pugongying: { traffic: 'organic', business: 'coop' },
  qiangua: null,
  xinhong: null,
}

/** 传播类 numbers are read on 日常笔记 whatever `business` the cost side uses. */
export const REACH_BUSINESS_SCOPE: BusinessScope = 'daily'

/** Env overrides, read before `ingest_sources.traffic_scope` / `business_scope`. */
export const SOURCE_SCOPE_ENV: Partial<Record<SourceId, { traffic: string; business: string }>> = {
  pugongying: { traffic: 'PGY_TRAFFIC_SCOPE', business: 'PGY_BUSINESS_SCOPE' },
}

/** Metrics whose value depends on the scope (the rest are fan facts, prices or fixed-window counts). */
export const SCOPED_METRIC_KEYS: readonly NumericMetricKey[] = [
  'impressionMedian', 'readMedian', 'interactionMedian', 'likeMedian', 'collectMedian', 'commentMedian',
  'engagementRate', 'completionRate', 'read3sRate', 'noteCount', 'viralCount', 'viralRate',
  'trafficSearchRatio', 'trafficRecommendRatio', 'trafficFollowRatio', 'cpr', 'cpe', 'cpeVideo', 'cpm', 'cpmRead',
]

/** Parameters ops fill in on the ingest page; every adapter accepts the same shape. */
export type SourceQuery = {
  source: SourceId
  window: MetricWindow
  keyword?: string
  category?: string
  region?: string
  followersMin?: number
  followersMax?: number
  priceMin?: number
  priceMax?: number
  health?: HealthGrade[]
  /** Specific creators to refresh (platform ids); when set, filters above are ignored. */
  externalIds?: string[]
  cursor?: string | null
  limit?: number
}

export type RawRecord = {
  source: SourceId
  platform: Platform
  externalId: string
  fetchedAt: string
  payload: Record<string, unknown>
}

export type SourcePage = {
  records: RawRecord[]
  nextCursor: string | null
  /** Vendor-side quota left, when exposed; surfaced on the dev page. */
  quotaRemaining?: number | null
  /**
   * Paid vendor calls this page made, for adapters the queue does not meter
   * call by call (`SourceAdapter.metered`); charged after the page. Omitted = 1.
   */
  calls?: number
  /** The page stopped before its last item; `nextCursor` resumes at the first item not fetched. */
  interrupted?: PageInterruption
  /** 查无结果 and per-item refusals met on the way; kept on the job. */
  vendorNotes?: VendorNote[]
}

export type NormalizedCreator = {
  creatorKey: string
  externalId: string
  platform: Platform
  displayName: string
  xhsId: string | null
  avatarUrl: string | null
  regions: string[]
  verticals: string[]
  metrics: CreatorMetrics
  /** What the source said beyond the shared metrics (see `SourceSignals`). */
  signals?: SourceSignals
  /** Field-level notes: which fields were missing or estimated by the vendor. */
  warnings: string[]
}

/**
 * 健康等级 as the platform grades it: since 2024-09 蒲公英 has two levels,
 * 健康 / 异常 (monthly, on violations, faked data, unreported ads, delivery).
 * There is no 「优秀」. 低活跃 is a different fact and lives in `lowActive`.
 */
export type HealthLevel = 'healthy' | 'abnormal'

/** 蒲公英「超过 X% 同类博主」per metric, as a 0–1 share. */
export const PLATFORM_RANK_KEYS = [
  'impressionMedian', 'readMedian', 'interactionMedian', 'interactionRate', 'followerGrowth',
  'activeFanRatio', 'engagedFanRatio', 'readFanRatio', 'completionRate',
] as const
export type PlatformRankKey = (typeof PLATFORM_RANK_KEYS)[number]

/**
 * Facts a source reports that do not fit a shared metric, or that must not be
 * mixed with one. Stored next to the metrics (`creators.source_signals`,
 * `creator_metrics_history.signals`); `null` = the source did not say.
 */
export type SourceSignals = {
  healthLevel: HealthLevel | null
  /** 蒲公英 低活跃: few recent posts. Not a health grade. */
  lowActive: boolean | null
  /** 蒲公英 dataSummary.isActive. */
  recentlyActive: boolean | null
  /** 视频完播率 (0–1). */
  completionRate: number | null
  /** 图文 3 秒阅读率 (0–1). */
  read3sRate: number | null
  /** 合作笔记总数 (all time); `metrics.coopNoteCount` is the recent window. */
  coopNoteCountTotal: number | null
  /** 新红「互动粉丝比」: no published definition, so kept apart from 蒲公英's 互动粉丝占比. */
  fanInteractionRatio: number | null
  /** 外溢进店 UV 中位数: 近 30 日跨域合作笔记的进店 UV 中位数. */
  storeVisitUvMedian: number | null
  /** 外溢进店单价 (元 / UV). */
  storeVisitUnitPrice: number | null
  platformRanks: Partial<Record<PlatformRankKey, number>>
  /** How many days a field covers when that is not `metrics.window` (蒲公英 活跃粉丝 = 28). */
  windowDays: Partial<Record<string, number>>
}

export function emptySignals(): SourceSignals {
  return {
    healthLevel: null,
    lowActive: null,
    recentlyActive: null,
    completionRate: null,
    read3sRate: null,
    coopNoteCountTotal: null,
    fanInteractionRatio: null,
    storeVisitUvMedian: null,
    storeVisitUnitPrice: null,
    platformRanks: {},
    windowDays: {},
  }
}

export type NormalizeResult = { ok: true; creator: NormalizedCreator } | { ok: false; errors: string[] }

/**
 * One creator can be reached through several sources (蒲公英 userId, 千瓜 达人ID …).
 * Rows are merged on `xhsId` (小红书号) when the platform exposes it; every
 * (source, externalId) pair we have seen is kept so refreshes stay addressable.
 */
export type CreatorSourceLink = {
  source: SourceId
  externalId: string
  firstSeenAt: string
  lastSeenAt: string
}

/**
 * One snapshot per creator, source, window and Beijing day (a later fetch the
 * same day overwrites it); `creators.metrics` is just the latest one. Trends
 * (涨粉、CPE 变化) are read from snapshots, never recomputed.
 */
export type MetricSnapshot = {
  id: string
  creatorId: string
  source: SourceId
  window: CreatorMetrics['window']
  fetchedAt: string
  jobId: string | null
  metrics: CreatorMetrics
}

/**
 * Least-squares line through ln(followers) over days: `perDay` is the slope,
 * `growth30d` = e^(30·perDay) − 1 (the steady rate, "about +4% a month"), `r2`
 * how well a straight line fits. Needs ≥ 3 points over ≥ 7 days.
 */
export type FollowerSlope = {
  perDay: number
  growth30d: number
  r2: number | null
  points: number
  spanDays: number
}

export type TrendHintKind = 'follower_jump' | 'follower_drop' | 'engagement_outlier' | 'followers_up_engagement_down'
export type TrendLocale = 'zh-CN' | 'en' | 'ko'

/** A plain-language heads-up about the numbers. Never used for ranking. */
export type TrendHint = {
  kind: TrendHintKind
  source: SourceId
  params: Record<string, number | string>
  messages: Record<TrendLocale, string>
}

/** Sources are never mixed on one line: each keeps its own series. */
export type TrendSeries = {
  source: SourceId
  snapshots: MetricSnapshot[]
  followerSlope: FollowerSlope | null
}

export type CreatorTrends = {
  creatorId: string
  window: CreatorMetrics['window']
  /** The source with the most points (then the most recent) — the default line. */
  primarySource: SourceId | null
  series: TrendSeries[]
  hints: TrendHint[]
}

/**
 * Ingest job lifecycle. Jobs are queued by the API and drained by a worker
 * that honours per-source rate limit / daily quota:
 *   queued → running → ok | partial (quota hit, cursor kept) | failed
 */
export const INGEST_JOB_STATUSES = ['queued', 'running', 'ok', 'partial', 'failed'] as const
export type IngestJobStatus = (typeof INGEST_JOB_STATUSES)[number]

export type IngestJobProgress = {
  status: IngestJobStatus
  /** Pages fetched so far; `cursor` is where the next run continues. */
  pagesDone: number
  cursor: string | null
  /** Billed vendor calls this job used (list, detail and every enrichment call). */
  quotaUsed: number
  /** What those calls cost at list price (USD); unpriced endpoints add 0. */
  costUsd: number
  /** Requests sent, billed or not. */
  vendorRequests: number
  /** Answers with nothing in them (查无结果), billed all the same. */
  emptyCount: number
  /** Latest 查无结果 / per-item refusals, newest last. */
  vendorNotes: VendorNote[]
  attempts: number
  nextRunAt: string | null
  error: string | null
}

/**
 * One drainer, one job at a time. The queue is deliberately *not* fanned out:
 * every vendor charges per call and enforces its own per-minute ceiling, so a
 * second worker buys nothing and doubles the bill. Instead:
 *
 * - every API process may host the loop, but only the one holding the Postgres
 *   advisory lock `INGEST_QUEUE_LOCK` drains (others idle, ready to take over);
 * - the loop takes a single due job per tick and finishes it before looking again;
 * - the claim writes a lease (`lockedBy`, `leaseExpiresAt`); a `running` job is
 *   only re-claimable once its lease has expired, so a crashed drainer is
 *   recovered without two workers ever fetching the same page.
 */
export const INGEST_QUEUE_LOCK = 4_912_733
export const INGEST_LEASE_MS = 60_000
export const INGEST_MAX_ATTEMPTS = 3

/**
 * Why an attempt stopped. `permanent` failures are not worth a retry — the
 * same call will fail the same way until a human changes something — so they
 * skip the backoff ladder and go straight to the dead-letter list.
 */
export const INGEST_FAILURE_CODES = [
  'SOURCE_UNAVAILABLE',
  'VENDOR_REJECTED',
  'CONFIG_MISSING',
  'QUOTA_EXHAUSTED',
  'BUDGET_EXHAUSTED',
  'BALANCE_EXHAUSTED',
  'CREDENTIAL_INVALID',
  'VENDOR_INNER_ERROR',
  'VENDOR_TIMEOUT',
  'SOURCE_PAUSED',
  'CANCELLED',
  'RECORD_INVALID',
  'RECORD_WRITE_FAILED',
  'UNKNOWN',
] as const
export type IngestFailureCode = (typeof INGEST_FAILURE_CODES)[number]

/**
 * Vendor answers by what they mean for the queue:
 *   402                 → the account cannot pay: permanent, and the source is paused
 *   401                 → the credential is wrong: permanent
 *   400                 → our request is wrong (the adapter already tried it twice): permanent
 *   403 / 404 / 422 …   → rejected: permanent
 *   429 / 408 / 5xx     → come back later: transient, `Retry-After` honoured
 *   timeout             → transient; the call may have been billed
 *   200 + inner failure → permanent (billed, and the same request fails the same way)
 */
export function classifyIngestFailure(message: string): {
  code: IngestFailureCode
  permanent: boolean
} {
  const text = message.toLowerCase()
  if (/unsupported adapter|missing credential|no record list|field map/.test(text)) {
    return { code: 'CONFIG_MISSING', permanent: true }
  }
  if (/ inner error /.test(text)) return { code: 'VENDOR_INNER_ERROR', permanent: true }
  if (/http 402\b|balance exhausted/.test(text)) return { code: 'BALANCE_EXHAUSTED', permanent: true }
  if (/http 401\b|credential invalid/.test(text)) return { code: 'CREDENTIAL_INVALID', permanent: true }
  if (/ timeout after /.test(text)) return { code: 'VENDOR_TIMEOUT', permanent: false }
  if (/request rejected/.test(text)) return { code: 'VENDOR_REJECTED', permanent: true }
  const http = text.match(/http (\d{3})/)
  if (http) {
    const status = Number(http[1])
    if (status >= 400 && status < 500 && status !== 429 && status !== 408) {
      return { code: 'VENDOR_REJECTED', permanent: true }
    }
  }
  return { code: 'SOURCE_UNAVAILABLE', permanent: false }
}

/** Failures that take the whole source offline until a human resumes it (运维端首页提醒). */
export const SOURCE_PAUSING_FAILURES: readonly IngestFailureCode[] = ['BALANCE_EXHAUSTED']

/**
 * Dead letters. Nothing that failed is thrown away: a job that ran out of
 * attempts (or failed permanently) parks here with the parameters and cursor
 * needed to continue it, and every single record that could not be read or
 * written parks here with its original payload. Ops replays or dismisses;
 * the queue itself never retries a dead letter on its own.
 */
export const DEAD_LETTER_KINDS = ['job', 'record'] as const
export type DeadLetterKind = (typeof DEAD_LETTER_KINDS)[number]

export const DEAD_LETTER_STATES = ['open', 'replayed', 'dismissed'] as const
export type DeadLetterState = (typeof DEAD_LETTER_STATES)[number]

/** A replay that keeps failing is a poison message; stop offering it. */
export const DEAD_LETTER_MAX_REPLAYS = 3

export type DeadLetter = {
  id: string
  kind: DeadLetterKind
  state: DeadLetterState
  source: SourceId
  jobId: string | null
  /** Present on record dead letters: who the payload was about. */
  externalId: string | null
  code: IngestFailureCode
  /** Vendor / validation message, trimmed. Never contains credentials. */
  message: string
  attempts: number
  replayCount: number
  /** Job dead letters carry the query + cursor so a replay continues, not restarts. */
  query: SourceQuery | null
  cursor: string | null
  /** Record dead letters carry the untouched vendor payload. */
  payload: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  resolvedBy: string | null
  /** Job created by a replay (job dead letters) — follow it to see the outcome. */
  replayJobId: string | null
}

/**
 * How we reach 蒲公英. All three return the same `solar` JSON, so one
 * normalizer serves every gateway:
 *   official   — ad-market.xiaohongshu.com 开放平台 (docs behind partner login)
 *   tikhub     — api.tikhub.io (mainland: api.tikhub.dev) /api/v1/xiaohongshu/pgy/*   (Bearer, POST JSON)
 *   justoneapi — api.justoneapi.com /api/xiaohongshu-pgy/api/solar/*  (token query, GET)
 */
export const PGY_GATEWAYS = ['official', 'tikhub', 'justoneapi'] as const
export type PgyGateway = (typeof PGY_GATEWAYS)[number]

/** TikHub hosts: the international one, and the one reachable from mainland China. */
export const TIKHUB_BASE_URLS = { global: 'https://api.tikhub.io', mainland: 'https://api.tikhub.dev' } as const

export const PGY_GATEWAY_BASE: Record<PgyGateway, string> = {
  official: 'https://ad-market.xiaohongshu.com',
  tikhub: TIKHUB_BASE_URLS.global,
  justoneapi: 'https://api.justoneapi.com',
}

/** How the process reaches 蒲公英 right now; `tokenVar` names the variable in use (never its value). */
export type PgyAccess = { gateway: PgyGateway; token: string; baseUrl: string; tokenVar: string; legacy: boolean }

/**
 * TikHub is the default gateway: `TIKHUB_API_KEY` + `TIKHUB_BASE_URL`
 * (default api.tikhub.io, mainland api.tikhub.dev). The older
 * `PGY_ACCESS_TOKEN` + `PGY_GATEWAY=tikhub` + `PGY_BASE_URL` still work
 * (`legacy: true`). JustOneAPI and the official platform keep
 * `PGY_ACCESS_TOKEN` / `PGY_BASE_URL`. `null` = no credential → fixture data.
 */
export function pgyAccess(env: Record<string, string | undefined>): PgyAccess | null {
  const text = (name: string) => env[name]?.trim() || ''
  const requested = text('PGY_GATEWAY').toLowerCase() || 'tikhub'
  const gateway: PgyGateway = (PGY_GATEWAYS as readonly string[]).includes(requested) ? (requested as PgyGateway) : 'tikhub'
  const trim = (url: string) => url.replace(/\/+$/, '')
  if (gateway === 'tikhub') {
    const key = text('TIKHUB_API_KEY')
    const token = key || text('PGY_ACCESS_TOKEN')
    if (!token) return null
    const baseUrl = trim(text('TIKHUB_BASE_URL') || text('PGY_BASE_URL') || TIKHUB_BASE_URLS.global)
    return { gateway, token, baseUrl, tokenVar: key ? 'TIKHUB_API_KEY' : 'PGY_ACCESS_TOKEN', legacy: !key }
  }
  const token = text('PGY_ACCESS_TOKEN')
  if (!token) return null
  return { gateway, token, baseUrl: trim(text('PGY_BASE_URL') || PGY_GATEWAY_BASE[gateway]), tokenVar: 'PGY_ACCESS_TOKEN', legacy: false }
}

/**
 * Credentials are referenced by env var name, never stored in the DB.
 * 蒲公英 goes through TikHub by default (`TIKHUB_API_KEY`, see `pgyAccess`
 * for the older `PGY_ACCESS_TOKEN` and the other gateways);
 * 千瓜 / 新红 have no public API docs — tokens come from the vendor contract
 * and the endpoint/field map is configured via `*_BASE_URL` / `*_FIELD_MAP`.
 */
export type SourceCredentialRef = {
  source: SourceId
  /** The preferred credential: all of these set = configured. */
  envVars: string[]
  /** Other complete credential sets that also count (older names, other gateways). */
  alternatives?: string[][]
  /** Optional knobs shown next to the required ones on the ops page. */
  optionalEnvVars: string[]
}

export const SOURCE_CREDENTIALS: readonly SourceCredentialRef[] = [
  {
    source: 'pugongying',
    envVars: ['TIKHUB_API_KEY'],
    alternatives: [['PGY_ACCESS_TOKEN']],
    optionalEnvVars: [
      'TIKHUB_BASE_URL', 'PGY_GATEWAY', 'PGY_BASE_URL', 'PGY_BRAND_USER_ID', 'PGY_ENRICH', 'PGY_DATE_TYPES',
      'PGY_TIMEOUT_MS', 'PGY_DAILY_BUDGET_USD', 'PGY_TRAFFIC_SCOPE', 'PGY_BUSINESS_SCOPE',
      'PGY_SLOW_REFRESH_DAYS', 'PGY_ALL_TRAFFIC_REFERENCE_DAYS',
    ],
  },
  { source: 'qiangua', envVars: ['QIANGUA_TOKEN'], optionalEnvVars: ['QIANGUA_BASE_URL', 'QIANGUA_SEARCH_PATH', 'QIANGUA_FIELD_MAP'] },
  { source: 'xinhong', envVars: ['XINHONG_TOKEN'], optionalEnvVars: ['XINHONG_BASE_URL', 'XINHONG_SEARCH_PATH', 'XINHONG_FIELD_MAP'] },
]

export interface SourceAdapter {
  readonly id: SourceId
  /** Which SourceQuery fields the platform honours; the UI disables the rest. */
  readonly supports: readonly (keyof SourceQuery)[]
  /** Which metric keys this source can populate; drives the ingest page column hints. */
  readonly provides: readonly (keyof CreatorMetrics)[]
  /**
   * True when every paid request goes through `context.meter` (reserve before,
   * settle after). Otherwise the queue reserves one call per page and charges
   * `page.calls` afterwards.
   */
  readonly metered?: boolean
  fetch(query: SourceQuery, context?: FetchContext): Promise<SourcePage>
  normalize(raw: RawRecord): NormalizeResult
}

/**
 * `scope` is the source the id came from: vendor ids are only unique inside
 * one vendor (千瓜 10001 and 新红 10001 are different people), so a key
 * without the source would merge strangers.
 */
export function creatorKeyFor(scope: SourceId | Platform, externalId: string): string {
  return `${scope}:${externalId}`
}

/**
 * One spelling per 小红书号: trimmed, NFKC-folded (full-width → ASCII) and
 * lower-case, so "Cheongdam_Skin " and "cheongdam_skin" are one account.
 * The database folds every write the same way (`kcs_normalize_xhs_id`).
 */
export function normalizeXhsId(value: unknown): string | null {
  if (value == null || typeof value === 'object') return null
  const text = String(value).normalize('NFKC').trim().toLowerCase()
  return text && !isPlaceholder(text) ? text : null
}

export function pickPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return undefined
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

/**
 * Why a value did not come through as a plain number. Surfaced as
 * `<field>.<issue>` warnings so ops can see the vendor wrote "5000-8000" or
 * "暂无" rather than a silent blank.
 *   placeholder — the vendor's way of saying "no data" ("-", "—", "暂无" …)
 *   range       — two numbers ("5000-8000", "1万~2万"); we do not pick one
 *   lowerBound  — "10万+": the number is kept as the lower bound
 *   unparseable — anything else that is not a number
 *   outOfRange  — a number that cannot be right for this field (negative
 *                 count, share above 100%, count past the integer column)
 */
export type NumberIssue = 'placeholder' | 'range' | 'lowerBound' | 'unparseable' | 'outOfRange' | 'notShown'

export type ParsedNumber = { value: number | null; issue: NumberIssue | null }

const PLACEHOLDERS = new Set([
  '-', '--', '---', '—', '——', '–', '/', '\\', '.', '?', '*',
  'n/a', 'na', 'nan', 'null', 'none', 'nil', 'undefined',
  '暂无', '无', '未知', '无数据', '暂无数据', '未公开', '未展示', '不展示', '-%',
])

/** Powers of ten for the unit suffixes vendors use (Chinese, Korean, Latin). */
const UNIT_EXPONENT: Record<string, number> = {
  千: 3, 천: 3, k: 3, K: 3,
  万: 4, 萬: 4, 만: 4, w: 4, W: 4,
  百万: 6, m: 6, M: 6,
  亿: 8, 億: 8, 억: 8,
}

const NUMBER_PATTERN = /^([+-]?)(\d+(?:\.\d*)?|\.\d+)(?:e([+-]?\d+))?(百万|[千천kK万萬만wWmM亿億억])?(\+)?$/i
const RANGE_PATTERN = /\d\s*(?:百万|[千천kK万萬만wWmM亿億억])?\s*(?:-|~|～|〜|–|—|至|到)\s*[-+]?\.?\d/

/** True for the strings vendors put where a value is missing. */
export function isPlaceholder(value: unknown): boolean {
  return typeof value === 'string' && PLACEHOLDERS.has(value.normalize('NFKC').trim().toLowerCase())
}

/** Shift the decimal point in a digit string without going through a float. */
function scaleDecimal(intPart: string, fracPart: string, exponent: number): number {
  const digits = `${intPart}${fracPart}`.replace(/^0+(?=\d)/, '')
  const point = digits.length - fracPart.length + exponent
  let text: string
  if (point <= 0) text = `0.${'0'.repeat(-point)}${digits}`
  else if (point >= digits.length) text = `${digits}${'0'.repeat(point - digits.length)}`
  else text = `${digits.slice(0, point)}.${digits.slice(point)}`
  return Number(text)
}

/**
 * Reads what vendors write for a number. Unit suffixes are applied in decimal
 * (`0.07万` is exactly 700, `12.3456万` exactly 123456), so a count never
 * arrives as 700.0000000000001 and trips an integer column.
 */
export function parseNumber(value: unknown): ParsedNumber {
  if (value == null) return { value: null, issue: null }
  if (typeof value === 'number') return Number.isFinite(value) ? { value, issue: null } : { value: null, issue: 'unparseable' }
  if (typeof value === 'bigint') return { value: Number(value), issue: null }
  if (typeof value !== 'string') return { value: null, issue: 'unparseable' }
  let s = value.normalize('NFKC').trim()
  if (s === '') return { value: null, issue: null }
  if (PLACEHOLDERS.has(s.toLowerCase())) return { value: null, issue: 'placeholder' }
  s = s.replace(/^[\u2212\u2012\u2013\uFE63]/, '-').replace(/^([+-]?)\s*[¥￥]\s*/, '$1')
  if (RANGE_PATTERN.test(s.replace(/^[+-]/, ''))) return { value: null, issue: 'range' }
  s = s.replace(/[\s\u00A0\u2009\u202F]/g, '')
  if (s.includes(',')) {
    // Only thousands separators: "1,234,567.5". "1.234,5" is ambiguous.
    if (!/^[+-]?\d{1,3}(,\d{3})+(\.\d*)?(?!\d)/.test(s)) return { value: null, issue: 'unparseable' }
    s = s.replace(/,/g, '')
  }
  const m = NUMBER_PATTERN.exec(s)
  if (!m) return { value: null, issue: 'unparseable' }
  const [, sign, mantissa, exp, unit, plus] = m
  const [intPart = '', fracPart = ''] = mantissa!.split('.')
  const exponent = Number(exp ?? 0) + (unit ? UNIT_EXPONENT[unit]! : 0)
  const magnitude = scaleDecimal(intPart || '0', fracPart, exponent)
  if (!Number.isFinite(magnitude)) return { value: null, issue: 'unparseable' }
  const n = sign === '-' ? -magnitude : magnitude
  return { value: Object.is(n, -0) ? 0 : n, issue: plus ? 'lowerBound' : null }
}

export function toNumber(value: unknown): number | null {
  return parseNumber(value).value
}

/** Largest value a Postgres `integer` column (followers) holds. */
export const MAX_COUNT = 2_147_483_647

/**
 * Whole-number counts (粉丝、中位数、篇数). Rounded to an integer; negative
 * only when `signed` (涨粉 can be negative), and never past `MAX_COUNT`.
 */
export function toCount(value: unknown, options: { signed?: boolean } = {}): ParsedNumber {
  const parsed = parseNumber(value)
  if (parsed.value == null) return parsed
  const n = Math.round(parsed.value)
  if (Math.abs(n) > MAX_COUNT || (n < 0 && !options.signed)) return { value: null, issue: 'outOfRange' }
  return { value: n, issue: parsed.issue }
}

/** Money and unit costs: a number that is not negative. */
export function toAmount(value: unknown): ParsedNumber {
  const parsed = parseNumber(value)
  if (parsed.value != null && parsed.value < 0) return { value: null, issue: 'outOfRange' }
  return parsed
}

/**
 * How a source writes a ratio field. Declared per field, never guessed from
 * the size of the value: 0.8 in a percent field is 0.8% and 1.2 in a ratio
 * field is 120%, and no threshold can tell those apart.
 *   percent — "91" / 91 mean 91%
 *   ratio   — 0.91 means 91%
 * A string with a trailing `%` / `％` is always a percent.
 */
export type RatioUnit = 'percent' | 'ratio'

/**
 * Where a field sits in a vendor response: candidate paths in order, plus the
 * unit for ratio fields. A bare path list is fine for everything else.
 */
export type FieldSpec = readonly string[] | { readonly paths: readonly string[]; readonly unit?: RatioUnit }

export function fieldPaths(spec: FieldSpec | undefined): readonly string[] {
  if (!spec) return []
  return Array.isArray(spec) ? spec : (spec as { paths: readonly string[] }).paths
}

export function fieldUnit(spec: FieldSpec | undefined): RatioUnit | undefined {
  return spec && !Array.isArray(spec) ? (spec as { unit?: RatioUnit }).unit : undefined
}

/**
 * Medians, quotes and unit costs: vendors write 0 when the platform does not
 * show the number (too few notes, no quote set). A real 0 is not possible, so
 * 0 is read as "not shown" and never ranks as the cheapest CPE.
 */
export const ZERO_MEANS_HIDDEN_KEYS: readonly NumericMetricKey[] = [
  'impressionMedian', 'readMedian', 'interactionMedian', 'likeMedian', 'collectMedian', 'commentMedian',
  'coopReadMedian', 'coopInteractionMedian', 'priceImage', 'priceVideo', 'cpr', 'cpe', 'cpeVideo', 'cpm', 'cpmRead',
  'storeVisitUvMedian', 'storeVisitUnitPrice',
]

/** Ratio metrics that are a share of a whole: outside 0–1 they cannot be right. */
export const SHARE_METRIC_KEYS: readonly NumericMetricKey[] = [
  'readFanRatio', 'activeFanRatio', 'engagedFanRatio', 'completionRate', 'read3sRate', 'viralRate',
  'purchaseIntentCommentRatio', 'trafficSearchRatio', 'trafficRecommendRatio', 'trafficFollowRatio', 'authenticity',
]

/** "3.2%" → 0.032; 3.2 → 0.032 in a percent field; 0.032 stays 0.032 in a ratio field. */
export function toRatio(value: unknown, unit: RatioUnit | boolean = 'ratio'): number | null {
  if (value == null || value === '') return null
  const text = typeof value === 'string' ? value.normalize('NFKC').trim() : null
  if (text?.endsWith('%')) {
    const n = toNumber(text.slice(0, -1))
    return n == null ? null : n / 100
  }
  const n = toNumber(value)
  if (n == null) return null
  return unit === true || unit === 'percent' ? n / 100 : n
}

/** `toRatio` with the reason when nothing usable came through; shares are held to 0–1. */
export function parseRatio(value: unknown, unit: RatioUnit, options: { share?: boolean } = {}): ParsedNumber {
  const n = toRatio(value, unit)
  if (n == null) return { value: null, issue: value == null || value === '' ? null : parseNumber(value).issue ?? 'unparseable' }
  if (options.share && (n < 0 || n > 1)) return { value: null, issue: 'outOfRange' }
  return { value: n, issue: null }
}

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(/[,，、/|]/).map((s) => s.trim()).filter(Boolean)
  return []
}

/** A vendor's 健康等级 text on the two official levels; 「优秀」「普通」 are both 健康. */
export function toHealthLevel(value: unknown): HealthLevel | null {
  if (value == null) return null
  const s = String(value).normalize('NFKC').trim().toLowerCase()
  if (['健康', '正常', '优秀', '良好', '普通', 'healthy', 'normal', 'excellent', 'good', 'a', 'b'].includes(s)) return 'healthy'
  if (['异常', '不健康', 'abnormal', 'unhealthy', 'bad', 'c'].includes(s)) return 'abnormal'
  return null
}

/** The metric grade for a level (the same two words). No level → unknown (`null`), never 健康. */
export function healthFromLevel(level: HealthLevel | null): HealthGrade | null {
  return level === 'healthy' || level === 'abnormal' ? level : null
}

export function toHealth(value: unknown): HealthGrade | null {
  return healthFromLevel(toHealthLevel(value))
}
