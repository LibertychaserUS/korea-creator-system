import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'

export function registerAuthRoutes(app: KcsApp, _env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/auth/me', async (context) => {
    const { user, denied } = await helpers.requireAuth(context)
    if (denied) return denied
    return context.json({ user })
  })
}
