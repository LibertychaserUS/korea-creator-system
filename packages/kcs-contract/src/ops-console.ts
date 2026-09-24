import type { AuditLogView } from './responses'

/**
 * Response shapes for the ops console (运维端): per-source calls and quota,
 * the audit stream, and the three-language copy check.
 */

export type PipelineSourceView = {
  id: string
  name: string
  adapterType: string
  enabled: boolean
  /** Calls per minute the drainer allows itself. */
  rateLimit: number | null
  /** Calls per quota day; `null` = not set. */
  quota: number | null
  /** The source's `quota_tz`: its quota day starts at midnight there. */
  quotaTimeZone: string
  /** This source's current quota day (`YYYY-MM-DD`). */
  quotaDay: string
  /** When this source's counter resets (ISO). */
  resetsAt: string
  callsToday: number
  remainingToday: number | null
  /** callsToday ÷ quota, `null` when there is no quota. */
  usageRatio: number | null
  /** Oldest first, one row per quota day that had calls, last 7 days including today. */
  recentDays: { day: string; calls: number }[]
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastErrorCode: string | null
  /** `live` / `fixture` of the latest run, `null` before the first run. */
  lastMode: string | null
  running: number
  waiting: number
  failed24h: number
  written24h: number
  openDeadLetters: number
}

export type DevPipeline = {
  /** The default zone's quota day (`YYYY-MM-DD`); a source with its own `quota_tz` says so on its row. */
  day: string
  /** The default quota zone (`Asia/Shanghai`). */
  quotaTimeZone: string
  /** When counters in the default zone reset (ISO). */
  resetsAt: string
  totals: { sources: number; jobs: number; review: number; released: number }
  sources: PipelineSourceView[]
}

export type AuditEntryView = AuditLogView & { actorName: string | null; actorEmail: string | null }

export type DevAuditPage = {
  items: AuditEntryView[]
  total: number
  page: number
  pageSize: number
  /** Every action seen in the trail with its count, for the filter list. */
  actions: { action: string; n: number }[]
}

/** `GET /api/dev/cohorts`: how the pool's percentiles are formed (built by the pool's own tables). */
export type DevCohortCalibration = {
  /** `null` = the fallback for sources without their own figure. */
  source: string | null
  target: number
  required: number | null
  method: 'bootstrap' | 'analytic' | string
  poolSize: number
  basis: {
    metrics?: Record<string, { values: number; required: number | null; halfWidths: Record<string, number> }>
    rules?: { resamples: number; halfWidth: number; probes: readonly number[]; candidates: readonly number[]; seed: number }
  } | null
  computedAt: string
}

export type DevCohortsReport = {
  rules: { spanDecades: number; staleDays: number; wilsonZ: number; analyticSample: number; referenceMinSample: number }
  calibration: DevCohortCalibration[]
  groups: { key: string; source: string | null; window: number; contentForm: string | null; size: number; rankedFrom: string | null; rankedTo: string | null }[]
  referenceLines: { group: string; tier: string; key: string; n: number; p25: number; p50: number; p75: number; computedAt: string | null }[]
}

export type LocaleKeyReport = {
  locale: string
  keys: number
  /** Keys the reference locale has and this one lacks. */
  missing: string[]
  /** Keys this locale has and the reference lacks. */
  extra: string[]
  /** Keys whose text is empty or only whitespace. */
  empty: string[]
  /** Keys whose `{placeholders}` differ from the reference. */
  placeholderMismatch: string[]
}

export type LocaleCheck = {
  reference: string
  locales: LocaleKeyReport[]
  ok: boolean
}

export type DevI18nReport = {
  locales: string[]
  defaultLocale: string
  themes: string[]
  /** Spreadsheet export headers are built by the API, so the API checks them. */
  exportLabels: LocaleCheck
  checkedAt: string
}

export function flattenMessages(node: unknown, prefix = ''): Record<string, string> {
  if (typeof node === 'string') return { [prefix]: node }
  if (Array.isArray(node)) {
    return node.reduce<Record<string, string>>(
      (out, value, index) => Object.assign(out, flattenMessages(value, prefix ? `${prefix}.${index}` : String(index))),
      {},
    )
  }
  if (!node || typeof node !== 'object') return {}
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>(
    (out, [key, value]) => Object.assign(out, flattenMessages(value, prefix ? `${prefix}.${key}` : key)),
    {},
  )
}

function placeholders(text: string): string {
  return [...new Set([...text.matchAll(/\{\s*([A-Za-z_][\w]*)\s*\}/g)].map((m) => m[1]))].sort().join(',')
}

/**
 * Same keys, no empty text, same `{named}` placeholders in every language.
 * `messages` maps locale → message tree; the first locale is the reference
 * unless one is named.
 */
export function checkLocaleKeys(messages: Record<string, unknown>, reference = Object.keys(messages)[0]!): LocaleCheck {
  const flat = Object.fromEntries(Object.entries(messages).map(([name, tree]) => [name, flattenMessages(tree)]))
  const ref = flat[reference] ?? {}
  const refKeys = Object.keys(ref)
  const locales = Object.entries(flat).map(([locale, entries]): LocaleKeyReport => {
    const keys = Object.keys(entries)
    return {
      locale,
      keys: keys.length,
      missing: refKeys.filter((key) => !(key in entries)).sort(),
      extra: keys.filter((key) => !(key in ref)).sort(),
      empty: keys.filter((key) => !entries[key]!.trim()).sort(),
      placeholderMismatch: keys
        .filter((key) => key in ref && placeholders(entries[key]!) !== placeholders(ref[key]!))
        .sort(),
    }
  })
  const ok = locales.every((l) => !l.missing.length && !l.extra.length && !l.empty.length && !l.placeholderMismatch.length)
  return { reference, locales, ok }
}
