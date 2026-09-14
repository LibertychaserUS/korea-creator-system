import { readFileSync } from 'node:fs'
import {
  creatorKeyFor,
  deriveMetrics,
  emptyMetrics,
  pickPath,
  toHealth,
  toNumber,
  toRatio,
  toStringArray,
  type CreatorMetrics,
  type NormalizeResult,
  type RawRecord,
  type SourceId,
  type SourcePage,
  type SourceQuery,
} from '@kcs/contract'

export type FieldMap = Partial<Record<
  | keyof CreatorMetrics
  | 'displayName'
  | 'xhsId'
  | 'avatarUrl'
  | 'regions'
  | 'verticals'
  | 'externalId',
  readonly string[]
>>

export type AdapterPage = SourcePage & { sourceMode: 'live' | 'fixture' }

/** Common id keys across 蒲公英 (`userId`), vendors and our fixtures. */
export function payloadId(payload: Record<string, unknown>, fallback: string): string {
  const value = payload.userId ?? payload.external_id ?? payload.author_id ?? payload.user_id ?? payload.id ?? payload.博主ID ?? payload.达人ID
  return value == null || value === '' ? fallback : String(value)
}

/**
 * Vendors without public docs (千瓜 / 新红) ship their field list with the
 * contract. `<PREFIX>_FIELD_MAP` accepts a JSON object of
 * `{ canonicalKey: ["path.in.response", ...] }` and is merged over the
 * in-code default so a schema fix needs no redeploy.
 */
export function fieldMapFromEnv(envName: string, defaults: FieldMap): FieldMap {
  const raw = process.env[envName]
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const merged: Record<string, readonly string[]> = { ...(defaults as Record<string, readonly string[]>) }
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value) && value.every((v) => typeof v === 'string')) merged[key] = value as string[]
      else if (typeof value === 'string') merged[key] = [value]
    }
    return merged as FieldMap
  } catch {
    return defaults
  }
}

export function first(payload: unknown, paths: readonly string[] | undefined): unknown {
  for (const path of paths ?? []) {
    const value = pickPath(payload, path)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

export function normalizeRecord(raw: RawRecord, map: FieldMap, percentFields: readonly (keyof CreatorMetrics)[] = []): NormalizeResult {
  const externalId = String(first(raw.payload, map.externalId) ?? raw.externalId ?? '').trim()
  const displayName = String(first(raw.payload, map.displayName) ?? '').trim()
  if (!externalId || !displayName) return { ok: false, errors: [!externalId ? 'externalId.missing' : 'displayName.missing'] }

  const metrics = emptyMetrics((toNumber(first(raw.payload, map.window)) === 90 ? 90 : 30))
  const numericKeys = Object.keys(metrics).filter((key) =>
    !['window', 'health', 'coopBrands', 'audience', 'vendorIndex'].includes(key),
  ) as (keyof CreatorMetrics)[]
  const warnings: string[] = []
  for (const key of numericKeys) {
    const paths = map[key]
    if (!paths) continue
    const value = first(raw.payload, paths)
    const parsed = percentFields.includes(key) ? toRatio(value, typeof value === 'number' && value > 1) : toNumber(value)
    ;(metrics as Record<string, unknown>)[key] = parsed
    if (parsed == null) warnings.push(`${String(key)}.missing`)
  }
  metrics.health = toHealth(first(raw.payload, map.health))
  metrics.coopBrands = toStringArray(first(raw.payload, map.coopBrands))
  const indexValue = toNumber(first(raw.payload, map.vendorIndex))
  if (indexValue != null) metrics.vendorIndex = { name: raw.source === 'qiangua' ? '千瓜指数' : '新红指数', value: indexValue, max: 1000 }

  return {
    ok: true,
    creator: {
      creatorKey: creatorKeyFor('xhs', externalId),
      externalId,
      platform: 'xhs',
      displayName,
      xhsId: String(first(raw.payload, map.xhsId) ?? externalId) || null,
      avatarUrl: String(first(raw.payload, map.avatarUrl) ?? '') || null,
      regions: toStringArray(first(raw.payload, map.regions)),
      verticals: toStringArray(first(raw.payload, map.verticals)),
      metrics: deriveMetrics(metrics),
      warnings,
    },
  }
}

export function fixturePage(source: SourceId, fixtureUrl: URL, query: SourceQuery): AdapterPage {
  let payloads = JSON.parse(readFileSync(fixtureUrl, 'utf8')) as Record<string, unknown>[]
  if (query.externalIds?.length) {
    const wanted = new Set(query.externalIds.map(String))
    payloads = payloads.filter((p, index) => wanted.has(payloadId(p, `${source}-${index + 1}`)))
  }
  if (query.limit) payloads = payloads.slice(0, Math.max(0, query.limit))
  const fetchedAt = new Date().toISOString()
  return {
    sourceMode: 'fixture',
    nextCursor: null,
    records: payloads.map((payload, index) => ({
      source,
      platform: 'xhs',
      externalId: payloadId(payload, `${source}-${index + 1}`),
      fetchedAt,
      payload,
    })),
  }
}

export function filterFixturePage(
  page: AdapterPage,
  query: SourceQuery,
  normalize: (raw: RawRecord) => NormalizeResult,
): AdapterPage {
  const records = page.records.filter((raw) => {
    const result = normalize(raw)
    if (!result.ok) return false
    const creator = result.creator
    const metrics = creator.metrics
    if (query.keyword) {
      const blob = [creator.displayName, ...creator.verticals, ...metrics.coopBrands].join(' ').toLowerCase()
      if (!blob.includes(query.keyword.toLowerCase())) return false
    }
    if (query.category && !creator.verticals.some((value) => value.includes(query.category!))) return false
    if (query.region && !creator.regions.some((value) => value.includes(query.region!))) return false
    if (query.followersMin != null && (metrics.followers == null || metrics.followers < query.followersMin)) return false
    if (query.followersMax != null && (metrics.followers == null || metrics.followers > query.followersMax)) return false
    if (query.priceMin != null && (metrics.priceImage == null || metrics.priceImage < query.priceMin)) return false
    if (query.priceMax != null && (metrics.priceImage == null || metrics.priceImage > query.priceMax)) return false
    if (query.health?.length && (metrics.health == null || !query.health.includes(metrics.health))) return false
    return true
  })
  return { ...page, records }
}

export async function fetchJsonPage(input: {
  source: SourceId
  url: string
  query: SourceQuery
  headers: Record<string, string>
  body?: Record<string, unknown>
  /** 新榜-style APIs take `application/x-www-form-urlencoded`. */
  encoding?: 'json' | 'form'
}): Promise<AdapterPage> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const payload = input.body ?? input.query
    const form = input.encoding === 'form'
    const body = form
      ? new URLSearchParams(
          Object.entries(payload)
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)]),
        ).toString()
      : JSON.stringify(payload)
    const response = await fetch(input.url, {
      method: 'POST',
      headers: { 'content-type': form ? 'application/x-www-form-urlencoded;charset=utf-8' : 'application/json', ...input.headers },
      body,
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`${input.source} HTTP ${response.status}`)
    const json = await response.json() as Record<string, unknown>
    const candidates = [json.data, (json.data as Record<string, unknown> | undefined)?.list, json.list, json.records]
    const payloads = candidates.find(Array.isArray) as Record<string, unknown>[] | undefined
    if (!payloads) throw new Error(`${input.source} response has no record list`)
    const fetchedAt = new Date().toISOString()
    return {
      sourceMode: 'live',
      records: payloads.map((payload, index) => ({
        source: input.source,
        platform: 'xhs',
        externalId: payloadId(payload, `${input.source}-${index + 1}`),
        fetchedAt,
        payload,
      })),
      nextCursor: String(json.next_cursor ?? (json.data as Record<string, unknown> | undefined)?.next_cursor ?? '') || null,
      quotaRemaining: toNumber(json.quota_remaining),
    }
  } finally {
    clearTimeout(timer)
  }
}
