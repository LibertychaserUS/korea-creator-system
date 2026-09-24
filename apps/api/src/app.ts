import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { API } from '@kcs/contract'
import { auditTrail } from './http/audit-trail'
import { createRouteHelpers } from './http/auth'
import { validationError } from './http/body'
import { jsonError } from './http/responses'
import type { AppEnv } from './http/types'
import { errorMessage, logEvent } from './log'
import { registerAuthRoutes } from './routes/auth'
import { registerDevRoutes } from './routes/dev'
import { registerDevCohortRoutes } from './routes/dev-cohorts'
import { registerDevCapacityRoutes } from './routes/dev-capacity'
import { registerDevConsoleRoutes } from './routes/dev-console'
import { registerIngestRoutes } from './routes/ingest'
import { registerOpsRoutes } from './routes/ops'
import { registerOpsCatalogRoutes } from './routes/ops-catalog'
import { registerPublicRoutes } from './routes/public'
import { registerSelectPoolRoutes } from './routes/select-pool'
import { registerSelectProjectRoutes } from './routes/select-projects'
import { registerSelectQueryRoutes } from './routes/select-queries'
import { registerShortlistRoutes } from './routes/shortlist'

export type { AppEnv, SessionUser } from './http/types'

// invalid_text_representation, numeric/datetime out of range, invalid datetime format
const PG_BAD_INPUT = new Set(['22P02', '22003', '22007', '22008'])

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** The four apps' origins (`WEB_ORIGIN`, comma separated); local ports when unset. */
export function webOrigins(source: NodeJS.ProcessEnv = process.env): string[] {
  return (
    source.WEB_ORIGIN
    || [7000, 7001, 7002, 7003, 7004, 7005]
      .map((port) => `http://localhost:${port}`)
      .join(',')
  )
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

export function createApp(env: AppEnv) {
  const app = new Hono()
  const origins = webOrigins()
  if (!process.env.WEB_ORIGIN && process.env.NODE_ENV === 'production') {
    logEvent('warn', 'cors.default_origins', { origins })
  }

  app.use(
    '*',
    cors({
      origin: origins,
      credentials: true,
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      // Browsers cache the preflight per URL for this long (Chrome caps it at 2 h).
      maxAge: 7200,
    }),
  )

  // The browser attaches the httpOnly `kcs_session` cookie to every request for
  // this host, including ones a foreign page triggers. A state-changing request
  // authenticated only by that cookie must come from one of the apps.
  // Bearer callers (SSR, scripts) send no ambient credentials and are exempt.
  app.use('*', async (context, next) => {
    if (SAFE_METHODS.has(context.req.method) || context.req.header('authorization')) return next()
    if (!/(?:^|;\s*)kcs_session=/.test(context.req.header('cookie') ?? '')) return next()
    const origin = context.req.header('origin')?.replace(/\/+$/, '')
    const sameOrigin = origin
      ? origins.includes(origin)
      : context.req.header('sec-fetch-site') !== 'cross-site'
    if (sameOrigin) return next()
    return jsonError(context, 403, 'AUTH-DENIED', 'origin_not_allowed')
  })

  const logRequests = process.env.LOG_REQUESTS !== '0'
  app.use('*', async (context, next) => {
    const started = performance.now()
    // Probes stay answerable while draining so readiness can report 503 itself.
    if (env.lifecycle?.draining && !context.req.path.startsWith(API.health.path)) {
      context.header('Connection', 'close')
      return jsonError(context, 503, 'UNAVAILABLE', 'shutting_down')
    }
    await next()
    const status = context.res.status
    if (!logRequests || (status < 400 && context.req.path.startsWith(API.health.path))) return
    logEvent(status >= 500 ? 'error' : 'info', 'http.request', {
      method: context.req.method,
      path: context.req.path,
      status,
      ms: Math.round((performance.now() - started) * 10) / 10,
    })
  })

  const helpers = createRouteHelpers(env)
  app.use('*', auditTrail(env, helpers))
  registerPublicRoutes(app, env, helpers)
  registerAuthRoutes(app, env, helpers)
  registerOpsRoutes(app, env, helpers)
  registerOpsCatalogRoutes(app, env, helpers)
  registerIngestRoutes(app, env, helpers)
  registerSelectPoolRoutes(app, env, helpers)
  registerSelectQueryRoutes(app, env, helpers)
  registerSelectProjectRoutes(app, env, helpers)
  registerShortlistRoutes(app, env, helpers)
  registerDevRoutes(app, env, helpers)
  registerDevCohortRoutes(app, env, helpers)
  registerDevConsoleRoutes(app, env, helpers)
  registerDevCapacityRoutes(app, env, helpers)

  app.onError((error, context) => {
    if (error instanceof HTTPException) return error.getResponse()
    if (error instanceof SyntaxError) return validationError(context, 'invalid_json')
    const pgCode = (error as { code?: unknown }).code
    if (pgCode === '23505') return jsonError(context, 409, 'CONFLICT', 'already_exists')
    if (pgCode === '23503') return validationError(context, 'invalid_reference')
    if (typeof pgCode === 'string' && PG_BAD_INPUT.has(pgCode)) {
      return validationError(context, 'invalid_value')
    }
    logEvent('error', 'http.unhandled', {
      method: context.req.method,
      path: context.req.path,
      name: error instanceof Error ? error.name : typeof error,
      message: errorMessage(error),
      code: typeof pgCode === 'string' ? pgCode : undefined,
    })
    return context.json(
      { error: { code: 'INTERNAL', message: 'internal_server_error' } },
      500,
    )
  })

  return app
}
