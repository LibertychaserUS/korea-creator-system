/**
 * SourceAdapter — the system is a parameterised crawler with a transform layer.
 *
 *   SourceQuery (crawler params) → adapter.fetch → RawRecord[] (platform JSON, stored verbatim)
 *   RawRecord → adapter.normalize → NormalizedCreator (identity + CreatorMetrics)
 *
 * Route A = 蒲公英 OpenAPI (official).  Route B = third-party data vendors
 * (千瓜 / 新红).  Self-built scraping (route C) is deliberately not a source.
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
 * Credentials are referenced by env var name, never stored in the DB.
 * Route A needs an app + long-lived token from ad-market.xiaohongshu.com;
 * route B vendors issue a bearer token per account.
 */
export type SourceCredentialRef = {
  source: SourceId
  envVars: string[]
}

export const SOURCE_CREDENTIALS: readonly SourceCredentialRef[] = [
  { source: 'pugongying', envVars: ['PGY_APP_ID', 'PGY_APP_SECRET', 'PGY_ACCESS_TOKEN'] },
  { source: 'qiangua', envVars: ['QIANGUA_TOKEN'] },
  { source: 'xinhong', envVars: ['XINHONG_TOKEN'] },
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
