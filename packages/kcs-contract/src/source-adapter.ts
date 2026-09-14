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
import type { CreatorMetrics, MetricWindow, HealthGrade, Platform } from './metrics'

export const SOURCE_IDS = ['pugongying', 'qiangua', 'xinhong'] as const
export type SourceId = (typeof SOURCE_IDS)[number]

export const SOURCE_ROUTE: Record<SourceId, 'official' | 'vendor'> = {
  pugongying: 'official',
  qiangua: 'vendor',
  xinhong: 'vendor',
}

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
  /** Field-level notes: which fields were missing or estimated by the vendor. */
  warnings: string[]
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
 * Every ingest writes an immutable snapshot; `creators.metrics` is just the
 * latest one. Trends (涨粉、CPE 变化) are read from snapshots, never recomputed.
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
  /** Vendor calls consumed by this job (each page / detail call is one). */
  quotaUsed: number
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
  'CANCELLED',
  'RECORD_INVALID',
  'RECORD_WRITE_FAILED',
  'UNKNOWN',
] as const
export type IngestFailureCode = (typeof INGEST_FAILURE_CODES)[number]

export function classifyIngestFailure(message: string): {
  code: IngestFailureCode
  permanent: boolean
} {
  const text = message.toLowerCase()
  if (/unsupported adapter|missing credential|no record list|field map/.test(text)) {
    return { code: 'CONFIG_MISSING', permanent: true }
  }
  const http = text.match(/http (\d{3})/)
  if (http) {
    const status = Number(http[1])
    // 401/403/404/422 → our request or our credentials are wrong; retrying is noise.
    // 429 and 5xx are the vendor asking us to come back later.
    if (status >= 400 && status < 500 && status !== 429 && status !== 408) {
      return { code: 'VENDOR_REJECTED', permanent: true }
    }
  }
  return { code: 'SOURCE_UNAVAILABLE', permanent: false }
}

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
 *   tikhub     — api.tikhub.io  /api/v1/xiaohongshu/pgy/*   (Bearer, POST JSON)
 *   justoneapi — api.justoneapi.com /api/xiaohongshu-pgy/api/solar/*  (token query, GET)
 */
export const PGY_GATEWAYS = ['official', 'tikhub', 'justoneapi'] as const
export type PgyGateway = (typeof PGY_GATEWAYS)[number]

/**
 * Credentials are referenced by env var name, never stored in the DB.
 * 蒲公英 needs one access token plus `PGY_GATEWAY` (defaults to tikhub);
 * 千瓜 / 新红 have no public API docs — tokens come from the vendor contract
 * and the endpoint/field map is configured via `*_BASE_URL` / `*_FIELD_MAP`.
 */
export type SourceCredentialRef = {
  source: SourceId
  envVars: string[]
  /** Optional knobs shown next to the required ones on the ops page. */
  optionalEnvVars: string[]
}

export const SOURCE_CREDENTIALS: readonly SourceCredentialRef[] = [
  {
    source: 'pugongying',
    envVars: ['PGY_ACCESS_TOKEN'],
    optionalEnvVars: ['PGY_GATEWAY', 'PGY_BASE_URL', 'PGY_BRAND_USER_ID', 'PGY_ENRICH'],
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
  fetch(query: SourceQuery): Promise<SourcePage>
  normalize(raw: RawRecord): NormalizeResult
}

export function creatorKeyFor(platform: Platform, externalId: string): string {
  return `${platform}:${externalId}`
}

export function pickPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return undefined
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

export function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const s = String(value).trim()
  const m = /^([\d.,]+)\s*([wW万kK]?)$/.exec(s.replace(/[,，\s]/g, ''))
  if (!m) return null
  const n = Number(m[1]!.replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  const unit = m[2]
  if (unit === 'w' || unit === 'W' || unit === '万') return n * 10_000
  if (unit === 'k' || unit === 'K') return n * 1_000
  return n
}

/** "3.2%" → 0.032; 3.2 → 0.032 when `percentInput`; 0.032 stays 0.032. */
export function toRatio(value: unknown, percentInput = false): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    const n = Number(value.trim().slice(0, -1))
    return Number.isFinite(n) ? n / 100 : null
  }
  const n = toNumber(value)
  if (n == null) return null
  return percentInput ? n / 100 : n
}

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(/[,，、/|]/).map((s) => s.trim()).filter(Boolean)
  return []
}

export function toHealth(value: unknown): HealthGrade | null {
  if (value == null) return null
  const s = String(value).trim().toLowerCase()
  if (['优秀', 'excellent', 'good', 'a', '1'].includes(s)) return 'excellent'
  if (['普通', 'normal', 'b', '2'].includes(s)) return 'normal'
  if (['异常', 'abnormal', 'bad', 'c', '3'].includes(s)) return 'abnormal'
  return null
}
