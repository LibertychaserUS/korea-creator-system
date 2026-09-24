import { readFileSync } from 'node:fs'
import {
  METRIC_FIELDS,
  SHARE_METRIC_KEYS,
  ZERO_MEANS_HIDDEN_KEYS,
  creatorKeyFor,
  deriveMetrics,
  emptyMetrics,
  emptySignals,
  healthFromLevel,
  fieldPaths,
  fieldUnit,
  isPlaceholder,
  normalizeXhsId,
  parseNumber,
  parseRatio,
  pickPath,
  toAmount,
  toCount,
  toHealthLevel,
  toNumber,
  toStringArray,
  type CreatorMetrics,
  type FieldSpec,
  type HealthGrade,
  type NormalizeResult,
  type NumericMetricKey,
  type ParsedNumber,
  type RatioUnit,
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
  FieldSpec
>>

/** Vendor fields that land in `SourceSignals`, not in the shared metrics. */
export type SignalFieldMap = Partial<Record<'vendorEngagedFanRatio' | 'videoCompletionRate' | 'picture3sReadRate', FieldSpec>>

export type AdapterPage = SourcePage & { sourceMode: 'live' | 'fixture' }

const INTEGER_LITERAL = /^-?\d+$/

/**
 * `JSON.parse` that keeps integers past 2^53 as their original digits.
 * A vendor id like 12345678901234567891 would otherwise round to
 * 12345678901234567000 and two creators would share one id.
 */
export function parseVendorJson(text: string): unknown {
  return JSON.parse(text, (_key, value, context?: { source?: string }) =>
    typeof value === 'number' && !Number.isSafeInteger(value) && context?.source && INTEGER_LITERAL.test(context.source)
      ? context.source
      : value,
  )
}

export async function readVendorJson(response: Response): Promise<Record<string, unknown>> {
  return parseVendorJson(await response.text()) as Record<string, unknown>
}

/** Common id keys across 蒲公英 (`userId`), vendors and our fixtures. */
export function payloadId(payload: Record<string, unknown>, fallback: string): string {
  const value = payload.userId ?? payload.external_id ?? payload.author_id ?? payload.user_id ?? payload.id ?? payload.博主ID ?? payload.达人ID
  return value == null || value === '' ? fallback : String(value)
}

/**
 * Vendors without public docs (千瓜 / 新红) ship their field list with the
 * contract. `<PREFIX>_FIELD_MAP` accepts a JSON object of
 * `{ canonicalKey: ["path.in.response", ...] }` or, for a ratio field,
 * `{ canonicalKey: { "paths": [...], "unit": "percent" | "ratio" } }`, and is
 * merged over the in-code default so a schema fix needs no redeploy. A bare
 * path list keeps the unit the default declared.
 */
export function fieldMapFromEnv(envName: string, defaults: FieldMap): FieldMap {
  const raw = process.env[envName]
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const merged: Record<string, FieldSpec> = { ...(defaults as Record<string, FieldSpec>) }
    const isPaths = (v: unknown): v is string[] => Array.isArray(v) && v.every((p) => typeof p === 'string')
    for (const [key, value] of Object.entries(parsed)) {
      const paths = isPaths(value) ? value : typeof value === 'string' ? [value] : isPaths((value as { paths?: unknown })?.paths) ? (value as { paths: string[] }).paths : null
      if (!paths) continue
      const declared = (value as { unit?: unknown })?.unit
      const unit = declared === 'percent' || declared === 'ratio' ? declared : fieldUnit(merged[key])
      merged[key] = unit ? { paths, unit } : paths
    }
    return merged as FieldMap
  } catch {
    return defaults
  }
}

/**
 * First usable value among `paths`. A placeholder ("-", "暂无" …) counts as
 * missing, so it never hides a real value under a later alias.
 */
export function first(payload: unknown, spec: FieldSpec | undefined, accept: (value: unknown) => boolean = () => true): unknown {
  for (const path of fieldPaths(spec)) {
    const value = pickPath(payload, path)
    if (value !== undefined && value !== null && value !== '' && !isPlaceholder(value) && accept(value)) return value
  }
  return undefined
}

/** Counts that may legitimately go below zero. */
const SIGNED_COUNTS = new Set<NumericMetricKey>(['followerGrowth'])

/** Parse one metric by what kind of number it is, collecting a warning when it did not come through. */
export function readMetric(
  key: NumericMetricKey,
  value: unknown,
  warnings: string[],
  unit: RatioUnit = 'ratio',
): number | null {
  const field = METRIC_FIELDS.find((f) => f.key === key)
  let parsed: ParsedNumber
  if (field?.unit === 'count') parsed = toCount(value, { signed: SIGNED_COUNTS.has(key) })
  else if (field?.unit === 'cny' || field?.unit === 'cnyPerUnit') parsed = toAmount(value)
  else if (field?.unit === 'ratio') parsed = parseRatio(value, unit, { share: SHARE_METRIC_KEYS.includes(key) })
  else parsed = parseNumber(value)
  if (parsed.value === 0 && ZERO_MEANS_HIDDEN_KEYS.includes(key)) parsed = { value: null, issue: 'notShown' }
  if (parsed.issue) warnings.push(`${key}.${parsed.issue}`)
  else if (parsed.value == null) warnings.push(`${key}.missing`)
  return parsed.value
}

export function normalizeRecord(raw: RawRecord, map: FieldMap, signalMap: SignalFieldMap = {}): NormalizeResult {
  const externalId = String(first(raw.payload, map.externalId) ?? raw.externalId ?? '').trim()
  const displayName = String(first(raw.payload, map.displayName) ?? '').trim()
  if (!externalId || !displayName) return { ok: false, errors: [!externalId ? 'externalId.missing' : 'displayName.missing'] }

  const metrics = emptyMetrics((toNumber(first(raw.payload, map.window)) === 90 ? 90 : 30))
  const numericKeys = Object.keys(metrics).filter((key) =>
    !['window', 'health', 'coopBrands', 'audience', 'vendorIndex'].includes(key),
  ) as NumericMetricKey[]
  const warnings: string[] = []
  for (const key of numericKeys) {
    const spec = map[key]
    if (!spec) continue
    // A 0 under one alias must not hide a shown value under the next.
    const value = ZERO_MEANS_HIDDEN_KEYS.includes(key)
      ? first(raw.payload, spec, (v) => toNumber(v) !== 0) ?? first(raw.payload, spec)
      : first(raw.payload, spec)
    ;(metrics as Record<string, unknown>)[key] = readMetric(key, value, warnings, fieldUnit(spec))
  }
  const signals = emptySignals()
  signals.healthLevel = toHealthLevel(first(raw.payload, map.health))
  metrics.health = healthFromLevel(signals.healthLevel)
  for (const key of ['vendorEngagedFanRatio', 'videoCompletionRate', 'picture3sReadRate'] as const) {
    const spec = signalMap[key]
    const value = spec ? first(raw.payload, spec) : undefined
    if (value === undefined) continue
    const parsed = parseRatio(value, fieldUnit(spec) ?? 'ratio', { share: true })
    if (parsed.issue) warnings.push(`${key}.${parsed.issue}`)
    signals[key] = parsed.value
  }
  metrics.coopBrands = toStringArray(first(raw.payload, map.coopBrands))
  const indexValue = toNumber(first(raw.payload, map.vendorIndex))
  if (indexValue != null) metrics.vendorIndex = { name: raw.source === 'qiangua' ? '千瓜指数' : '新红指数', value: indexValue, max: 1000 }

  const xhsId = first(raw.payload, map.xhsId)
  return {
    ok: true,
    creator: {
      creatorKey: creatorKeyFor(raw.source, externalId),
      externalId,
      platform: 'xhs',
      displayName,
      // A vendor id is not a 小红书号: without one the creator stays unmerged.
      xhsId: normalizeXhsId(xhsId),
      avatarUrl: String(first(raw.payload, map.avatarUrl) ?? '') || null,
      regions: toStringArray(first(raw.payload, map.regions)),
      verticals: toStringArray(first(raw.payload, map.verticals)),
      metrics: deriveMetrics(metrics),
      signals,
      warnings,
    },
  }
}

export function fixturePage(source: SourceId, fixtureUrl: URL, query: SourceQuery): AdapterPage {
  let payloads = parseVendorJson(readFileSync(fixtureUrl, 'utf8')) as Record<string, unknown>[]
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

/**
 * The health filter as the vendors apply it: a list without `abnormal` drops
 * 异常 and 低活跃 creators (蒲公英 `excludeLowActive`); `['abnormal']` alone
 * keeps only those. `excellent` and `normal` both mean 健康 now.
 */
export function matchesHealth(wanted: readonly HealthGrade[], health: HealthGrade | null, lowActive: boolean | null): boolean {
  const flagged = health === 'abnormal' || lowActive === true
  const wantsFlagged = wanted.includes('abnormal')
  const wantsHealthy = wanted.some((grade) => grade !== 'abnormal')
  return flagged ? wantsFlagged : wantsHealthy
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
    if (query.health?.length && !matchesHealth(query.health, metrics.health, creator.signals?.lowActive ?? null)) return false
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
    const json = await readVendorJson(response)
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
