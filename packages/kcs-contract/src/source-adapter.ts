/**
 * SourceAdapter — the seam between "big data" (external / open-platform APIs)
 * and our own creator spec.
 *
 * fetch(query)  → platform raw JSON (kept verbatim in `raw` for audit)
 * normalize(raw) → CreatorDraft in our schema
 *
 * Adapters are registered by `ingest_sources.adapter_type`; the ingest job
 * runner looks up the adapter, pages through fetch(), normalizes, and writes
 * creators. Field mapping for generic HTTP sources is itself data
 * (`OpenApiMapping`) so ops can bind a new platform without a deploy.
 */

export const ADAPTER_TYPES = ['mock', 'xlsx', 'openapi'] as const
export type AdapterType = (typeof ADAPTER_TYPES)[number]

export type SourceQuery = {
  /** Free text / keyword filter forwarded to the platform when supported. */
  keyword?: string
  /** Platform-specific cursor for pagination. */
  cursor?: string | null
  limit?: number
  /** Extra platform parameters, passed through as query string / body. */
  params?: Record<string, string | number | boolean>
}

export type RawRecord = {
  /** Stable id on the source platform (used for creator_key = `${platform}:${externalId}`). */
  externalId: string
  platform: string
  fetchedAt: string
  payload: Record<string, unknown>
}

export type SourcePage = {
  records: RawRecord[]
  nextCursor: string | null
}

/** What an adapter must produce for a creator to enter our system as `draft`. */
export type CreatorDraft = {
  creatorKey: string
  displayName: string
  xhsId?: string | null
  followers?: number | null
  followersUnknown?: boolean
  regions?: string[]
  verticals?: string[]
  categories?: string[]
  note?: string | null
  avatarUrl?: string | null
  er?: number | null
  price?: { amountMin?: number | null; amountMax?: number | null; currency?: string } | null
  collaborations?: { brand: string; at?: string | null }[]
  raw?: Record<string, unknown>
}

export type NormalizeResult =
  | { ok: true; draft: CreatorDraft; warnings: string[] }
  | { ok: false; errors: string[] }

export interface SourceAdapter<Config = unknown> {
  readonly type: AdapterType
  fetch(query: SourceQuery, config: Config): Promise<SourcePage>
  normalize(raw: RawRecord, config: Config): NormalizeResult
}

/**
 * Data-driven mapping for the generic `openapi` adapter. Paths are dot paths
 * into the platform JSON (`data.user.nickname`); `list` locates the array of
 * records in the page response, `cursor` the next-page token.
 */
export type OpenApiMapping = {
  baseUrl: string
  path: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  /** Name of an env var / secret holding the bearer token; never the token itself. */
  authSecretRef?: string | null
  list: string
  cursor?: string | null
  fields: {
    externalId: string
    displayName: string
    followers?: string
    xhsId?: string
    region?: string
    tags?: string
    note?: string
    avatarUrl?: string
    er?: string
    priceMin?: string
  }
}

export function pickPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return undefined
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(/[,，、/|]/).map((s) => s.trim()).filter(Boolean)
  return []
}

export function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[,，\s]/g, ''))
  return Number.isFinite(n) ? n : null
}
