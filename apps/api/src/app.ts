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
import { registerPublicRoutes } from './routes/public'
import { registerSelectPoolRoutes } from './routes/select-pool'
import { registerSelectProjectRoutes } from './routes/select-projects'
import { registerSelectQueryRoutes } from './routes/select-queries'

export type { AppEnv, SessionUser } from './http/types'

// invalid_text_representation, numeric/datetime out of range, invalid datetime format
const PG_BAD_INPUT = new Set(['22P02', '22003', '22007', '22008'])

export function createApp(env: AppEnv) {
  const app = new Hono()
  const origins = (
    process.env.WEB_ORIGIN
    || [7000, 7001, 7002, 7003, 7004, 7005]
      .map((port) => `http://localhost:${port}`)
      .join(',')
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  app.use(
    '*',
    cors({
      origin: origins,
      credentials: true,
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )

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
  registerIngestRoutes(app, env, helpers)
  registerSelectPoolRoutes(app, env, helpers)
  registerSelectQueryRoutes(app, env, helpers)
  registerSelectProjectRoutes(app, env, helpers)
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
