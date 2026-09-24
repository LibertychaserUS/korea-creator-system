import { readFileSync } from 'node:fs'
import {
  API,
  CREATOR_TIERS,
  METRIC_FIELDS,
  SOURCE_IDS,
  SOURCE_ROUTE,
} from '@kcs/contract'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'

const HEALTH_DB_TIMEOUT_MS = 2_000

function readVersion() {
  if (process.env.KCS_VERSION) return process.env.KCS_VERSION
  try {
    return String(JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version)
  } catch {
    return 'unknown'
  }
}

const VERSION = readVersion()

async function pingDb(env: AppEnv) {
  let timer: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      env.db.query('select 1'),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('db ping timed out')), HEALTH_DB_TIMEOUT_MS)
      }),
    ])
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export function registerPublicRoutes(app: KcsApp, env: AppEnv, _helpers: RouteHelpers) {
  /** Readiness: can this process serve a real request right now? */
  app.get(API.health.path, async (context) => {
    const db = (await pingDb(env)) ? 'ok' : 'down'
    const draining = Boolean(env.lifecycle?.draining)
    const ok = db === 'ok' && !draining
    return context.json(
      { ok, service: 'kcs-api', db, version: VERSION, ...(draining ? { draining } : {}) },
      ok ? 200 : 503,
    )
  })

  /** Liveness: the event loop answers. Never touches the DB, so a DB outage does not restart pods. */
  app.get(API.healthLive.path, (context) => context.json({ ok: true, version: VERSION }))

  app.get('/api/openapi.json', (context) =>
    context.json({
      openapi: '3.0.3',
      info: { title: '全球达人情报系统 API', version: '0.1.0' },
      paths: {
        '/api/auth/me': { get: { summary: '当前身份' } },
        '/api/ops/creators': { get: {}, post: {} },
        '/api/ops/creators/{id}/history': { get: {} },
        '/api/select/pool': { get: {} },
        '/api/select/creators/{id}': { get: {} },
        '/api/select/creators/{id}/history': { get: {} },
        '/api/select/queries': { get: {}, post: {} },
        '/api/select/queries/{id}': { get: {}, patch: {}, delete: {} },
        '/api/select/queries/run': { post: {} },
        '/api/select/projects': { get: {}, post: {} },
        '/api/metrics/fields': { get: {} },
        '/api/dev/health': { get: {} },
        '/api/ingest/adapters': { get: {} },
        '/api/ingest/fetch': { post: {} },
        '/api/ingest/raw/{creatorId}': { get: {} },
        '/api/ingest/jobs': { get: {}, post: { deprecated: true, summary: '410 GONE — use /api/ingest/fetch' } },
        '/api/ingest/jobs/{id}': { get: {} },
        '/api/ingest/jobs/{id}/retry': { post: {} },
        '/api/ingest/jobs/{id}/cancel': { post: {} },
      },
    }),
  )

  app.get('/api/metrics/fields', (context) =>
    context.json({
      fields: METRIC_FIELDS,
      tiers: CREATOR_TIERS,
      sources: SOURCE_IDS.map((id) => ({ id, route: SOURCE_ROUTE[id] })),
    }),
  )
}
