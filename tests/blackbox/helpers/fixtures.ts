import { PATHS } from './contract'
import { authed, type Session } from './auth'
import { itemsOf, request, type ApiRes, type Json } from './http'

export function runId(prefix = 'bb'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export type CreatorDraft = {
  displayName: string
  creatorKey?: string
  followers?: number
  followersUnknown?: boolean
  regions?: string[]
  verticals?: string[]
  source?: 'pugongying' | 'qiangua' | 'xinhong'
  metrics?: Record<string, unknown>
  categories?: string[]
  collaborations?: Array<{ brand: string; happenedAt?: string; note?: string }>
  price?: {
    amountMin?: number
    amountMax?: number
    currency?: string
    unit?: string
  }
  availableFrom?: string
  availableTo?: string
}

export async function createCreator(ops: Session, draft: CreatorDraft): Promise<Json> {
  const res = await authed(ops, 'POST', PATHS.opsCreators, {
    creatorKey: draft.creatorKey ?? runId('ck'),
    regions: draft.regions ?? ['서울'],
    categories: draft.categories ?? ['never_collaborated'],
    ...draft,
  })
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`create creator HTTP ${res.status}: ${res.raw.slice(0, 300)}`)
  }
  return res.json
}

export async function publishCreator(ops: Session, id: string): Promise<ApiRes> {
  return authed(ops, 'POST', PATHS.opsPublish(id))
}

export async function unpublishCreator(ops: Session, id: string): Promise<ApiRes> {
  return authed(ops, 'POST', PATHS.opsUnpublish(id))
}

export async function createAndPublish(ops: Session, draft: CreatorDraft): Promise<Json> {
  const created = await createCreator(ops, draft)
  const id = String(created.id)
  const pub = await publishCreator(ops, id)
  if (pub.status !== 200) {
    throw new Error(`publish ${id} HTTP ${pub.status}: ${pub.raw.slice(0, 300)}`)
  }
  return { ...created, ...pub.json, id }
}

/** Every page of the pool for this query (the endpoint pages at ≤ 100). */
export async function poolItems(
  selector: Session,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<Json[]> {
  const items: Json[] = []
  for (let page = 1; ; page += 1) {
    const res = await request('GET', PATHS.pool, { token: selector.token, query: { ...query, page, pageSize: 100 } })
    if (res.status !== 200) {
      throw new Error(`GET pool HTTP ${res.status}: ${res.raw.slice(0, 300)}`)
    }
    items.push(...itemsOf(res.json))
    if (page * 100 >= Number(res.json.total ?? 0)) return items
  }
}

export async function createProject(selector: Session, name: string): Promise<Json> {
  const res = await authed(selector, 'POST', PATHS.projects, { name })
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`create project HTTP ${res.status}: ${res.raw.slice(0, 300)}`)
  }
  return res.json
}
