import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createRouteHelpers } from './http/auth'
import type { AppEnv } from './http/types'
import { registerAuthRoutes } from './routes/auth'
import { registerDevRoutes } from './routes/dev'
import { registerIngestRoutes } from './routes/ingest'
import { registerOpsRoutes } from './routes/ops'
import { registerPublicRoutes } from './routes/public'
import { registerSelectPoolRoutes } from './routes/select-pool'
import { registerSelectProjectRoutes } from './routes/select-projects'
import { registerSelectQueryRoutes } from './routes/select-queries'

export type { AppEnv, SessionUser } from './http/types'

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

  const helpers = createRouteHelpers(env)
  registerPublicRoutes(app, env, helpers)
  registerAuthRoutes(app, env, helpers)
  registerOpsRoutes(app, env, helpers)
  registerIngestRoutes(app, env, helpers)
  registerSelectPoolRoutes(app, env, helpers)
  registerSelectQueryRoutes(app, env, helpers)
  registerSelectProjectRoutes(app, env, helpers)
  registerDevRoutes(app, env, helpers)

  app.onError((error, context) => {
    console.error(error)
    return context.json(
      { error: { code: 'INTERNAL', message: 'internal_server_error' } },
      500,
    )
  })

  return app
}
