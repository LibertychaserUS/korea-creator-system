import {
  pgyAccess,
  SOURCE_CREDENTIALS,
  SOURCE_IDS,
  SOURCE_ROUTE,
  type SourceAdapter,
  type SourceId,
} from '@kcs/contract'
import { pugongyingAdapter } from './pugongying'
import { qianguaAdapter } from './qiangua'
import { xinhongAdapter } from './xinhong'

const ADAPTERS: Record<SourceId, SourceAdapter> = {
  pugongying: pugongyingAdapter,
  qiangua: qianguaAdapter,
  xinhong: xinhongAdapter,
}

export function getAdapter(id: string): SourceAdapter | null {
  return id in ADAPTERS ? ADAPTERS[id as SourceId] : null
}

export function adapterConfigured(id: SourceId): boolean {
  if (id === 'pugongying') return pgyAccess(process.env) != null
  const ref = SOURCE_CREDENTIALS.find((item) => item.source === id)
  if (!ref) return false
  return [ref.envVars, ...(ref.alternatives ?? [])].some((set) => set.length > 0 && set.every((name) => process.env[name]?.trim()))
}

/** Which gateway and host a configured source goes through (names and hosts only, never tokens). */
function accessOf(id: SourceId): { gateway: string; host: string; legacyCredential: boolean } | null {
  if (id !== 'pugongying') return null
  const access = pgyAccess(process.env)
  if (!access) return null
  let host = access.baseUrl
  try {
    host = new URL(access.baseUrl).host
  } catch {
    // An unparsable base URL is shown as written; the first call will say what is wrong with it.
  }
  return { gateway: access.gateway, host, legacyCredential: access.legacy }
}

export function adapterDescriptions() {
  return SOURCE_IDS.map((id) => {
    const adapter = ADAPTERS[id]
    const ref = SOURCE_CREDENTIALS.find((item) => item.source === id)
    return {
      id,
      route: SOURCE_ROUTE[id],
      supports: adapter.supports,
      provides: adapter.provides,
      configured: adapterConfigured(id),
      envVars: ref?.envVars ?? [],
      alternatives: ref?.alternatives ?? [],
      optionalEnvVars: ref?.optionalEnvVars ?? [],
      access: accessOf(id),
    }
  })
}

export { pugongyingAdapter, qianguaAdapter, xinhongAdapter }
