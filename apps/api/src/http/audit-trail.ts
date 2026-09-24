import type { MiddlewareHandler } from 'hono'
import { errorMessage, logEvent } from '../log'
import { audit } from './audit'
import type { AppEnv, RouteHelpers } from './types'

type Json = Record<string, any> | null

/**
 * Writes that change what people see but whose handlers do not write an audit
 * row themselves. One row per successful call (2xx), after the handler ran,
 * with the signed-in actor. A handler that starts auditing on its own should
 * be taken off this list, or it will be recorded twice.
 */
type TrailRule = {
  method: 'POST' | 'PATCH' | 'DELETE' | 'GET'
  path: RegExp
  action: string
  entityType: string
  entityId: (match: RegExpMatchArray, request: Json, response: Json) => string | null
  summary: (match: RegExpMatchArray, request: Json, response: Json) => string
  /** Read the JSON request body before the handler consumes it. */
  readsBody?: boolean
}

const text = (value: unknown, max = 200) => (value == null ? '' : String(value)).slice(0, max)

export const AUDIT_TRAIL: readonly TrailRule[] = [
  {
    method: 'POST',
    path: /^\/api\/ingest\/fetch$/,
    action: 'ingest.fetch',
    entityType: 'ingest_job',
    entityId: (_, __, res) => res?.job?.id ?? res?.id ?? null,
    summary: (_, req) => [req?.source, req?.window ? `${req.window}d` : null, req?.keyword].filter(Boolean).map((v) => text(v, 60)).join(' · '),
    readsBody: true,
  },
  {
    method: 'POST',
    path: /^\/api\/ops\/batches$/,
    action: 'batch.upload',
    entityType: 'ingest_job',
    entityId: (_, __, res) => res?.id ?? null,
    summary: (_, __, res) => text(res?.batchName || res?.fileName || 'upload'),
  },
  {
    method: 'PATCH',
    path: /^\/api\/ops\/categories\/([^/]+)$/,
    action: 'category.update',
    entityType: 'category',
    entityId: (m) => decodeURIComponent(m[1]!),
    summary: (_, req) => Object.keys(req ?? {}).sort().join(','),
    readsBody: true,
  },
  {
    method: 'POST',
    path: /^\/api\/assets$/,
    action: 'asset.upload',
    entityType: 'asset',
    entityId: (_, __, res) => res?.key ?? null,
    summary: (_, __, res) => text(res?.key),
  },
  {
    method: 'POST',
    path: /^\/api\/select\/shortlist$/,
    action: 'shortlist.add',
    entityType: 'creator',
    entityId: (_, req) => (req?.creatorId ? String(req.creatorId) : null),
    summary: () => 'shortlist',
    readsBody: true,
  },
  {
    method: 'POST',
    path: /^\/api\/select\/queries$/,
    action: 'query.create',
    entityType: 'saved_query',
    entityId: (_, __, res) => res?.id ?? null,
    summary: (_, __, res) => text(res?.name),
  },
  {
    method: 'PATCH',
    path: /^\/api\/select\/queries\/([^/]+)$/,
    action: 'query.update',
    entityType: 'saved_query',
    entityId: (m) => decodeURIComponent(m[1]!),
    summary: (_, __, res) => text(res?.name),
  },
  {
    method: 'DELETE',
    path: /^\/api\/select\/queries\/([^/]+)$/,
    action: 'query.delete',
    entityType: 'saved_query',
    entityId: (m) => decodeURIComponent(m[1]!),
    summary: () => 'delete',
  },
  {
    method: 'POST',
    path: /^\/api\/select\/queries\/([^/]+)\/restore$/,
    action: 'query.restore',
    entityType: 'saved_query',
    entityId: (m) => decodeURIComponent(m[1]!),
    summary: (_, __, res) => text(res?.name),
  },
  {
    method: 'GET',
    path: /^\/api\/select\/projects\/([^/]+)\/export$/,
    action: 'project.export',
    entityType: 'project',
    entityId: (m) => decodeURIComponent(m[1]!),
    summary: () => 'export',
  },
]

async function readJsonSafe(read: () => Promise<string>): Promise<Json> {
  try {
    const raw = await read()
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function auditTrail(env: AppEnv, helpers: RouteHelpers): MiddlewareHandler {
  return async (context, next) => {
    const method = context.req.method
    const path = context.req.path
    let rule: TrailRule | undefined
    let match: RegExpMatchArray | null = null
    for (const candidate of AUDIT_TRAIL) {
      if (candidate.method !== method) continue
      match = path.match(candidate.path)
      if (match) {
        rule = candidate
        break
      }
    }
    if (!rule || !match) return next()
    const request = rule.readsBody && (context.req.header('content-type') || '').includes('json')
      ? await readJsonSafe(() => context.req.raw.clone().text())
      : null
    await next()
    const status = context.res.status
    if (status < 200 || status >= 300) return
    try {
      const { user } = await helpers.requireAuth(context)
      if (!user) return
      const isJson = (context.res.headers.get('content-type') || '').includes('json')
      const response = isJson ? await readJsonSafe(() => context.res.clone().text()) : null
      await audit(
        env.db,
        user.id,
        rule.action,
        rule.entityType,
        rule.entityId(match, request, response),
        rule.summary(match, request, response) || rule.action,
      )
    } catch (error) {
      // The write already happened; a missing trail row must not turn it into a 500.
      logEvent('error', 'audit.trail_failed', { action: rule.action, message: errorMessage(error) })
    }
  }
}
