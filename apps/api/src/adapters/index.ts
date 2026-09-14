import {
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
  const ref = SOURCE_CREDENTIALS.find((item) => item.source === id)
  return Boolean(ref?.envVars.every((name) => process.env[name]))
}

export function adapterDescriptions() {
  return SOURCE_IDS.map((id) => {
    const adapter = ADAPTERS[id]
    const envVars = SOURCE_CREDENTIALS.find((item) => item.source === id)?.envVars ?? []
    return {
      id,
      route: SOURCE_ROUTE[id],
      supports: adapter.supports,
      provides: adapter.provides,
      configured: adapterConfigured(id),
      envVars,
    }
  })
}

export { pugongyingAdapter, qianguaAdapter, xinhongAdapter }
