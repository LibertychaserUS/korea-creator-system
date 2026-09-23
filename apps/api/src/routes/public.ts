import {
  CREATOR_TIERS,
  METRIC_FIELDS,
  SOURCE_IDS,
  SOURCE_ROUTE,
} from '@kcs/contract'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'

export function registerPublicRoutes(app: KcsApp, _env: AppEnv, _helpers: RouteHelpers) {
  app.get('/api/health', (context) => context.json({ ok: true, service: 'kcs-api' }))

  app.get('/api/openapi.json', (context) =>
    context.json({
      openapi: '3.0.3',
      info: { title: '全球达人情报系统 API', version: '0.1.0' },
      paths: {
        '/api/auth/me': { get: { summary: '当前身份' } },
        '/api/ops/creators': { get: {}, post: {} },
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
        '/api/ingest/jobs': { get: {}, post: {} },
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
