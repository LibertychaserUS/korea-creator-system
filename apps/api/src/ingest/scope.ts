import {
  BUSINESS_SCOPES,
  SOURCE_IDS,
  SOURCE_SCOPE_DEFAULTS,
  SOURCE_SCOPE_ENV,
  TRAFFIC_SCOPES,
  type SourceId,
  type SourceScopeView,
} from '@kcs/contract'

function pickScope<T extends string>(allowed: readonly T[], ...candidates: unknown[]): { value: T; index: number } | null {
  for (let i = 0; i < candidates.length; i += 1) {
    const raw = candidates[i]
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
    if ((allowed as readonly string[]).includes(value)) return { value: value as T, index: i }
  }
  return null
}

const FROM = ['env', 'source', 'default'] as const

/**
 * The scope a source fetches with: env (`PGY_TRAFFIC_SCOPE` / `PGY_BUSINESS_SCOPE`)
 * over the `ingest_sources` columns over `SOURCE_SCOPE_DEFAULTS`. Unknown
 * values are skipped, not guessed. `null` for sources without scope switches.
 */
export function sourceScope(
  source: string,
  row: { traffic_scope?: unknown; business_scope?: unknown } | undefined,
  env: NodeJS.ProcessEnv = process.env,
): SourceScopeView | null {
  if (!(SOURCE_IDS as readonly string[]).includes(source)) return null
  const fallback = SOURCE_SCOPE_DEFAULTS[source as SourceId]
  if (!fallback) return null
  const names = SOURCE_SCOPE_ENV[source as SourceId]
  const traffic = pickScope(TRAFFIC_SCOPES, names ? env[names.traffic] : undefined, row?.traffic_scope, fallback.traffic)!
  const business = pickScope(BUSINESS_SCOPES, names ? env[names.business] : undefined, row?.business_scope, fallback.business)!
  return {
    traffic: traffic.value,
    business: business.value,
    from: { traffic: FROM[traffic.index]!, business: FROM[business.index]! },
  }
}
