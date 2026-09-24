import { audit } from '../http/audit'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'
import { capacityReport, runDailyCapacitySnapshot } from '../ops/capacity'

export function registerDevCapacityRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/dev/capacity', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    return context.json(await capacityReport(env))
  })

  app.post('/api/dev/capacity/snapshot', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'dev.retry')
    if (denied) return denied
    const result = await runDailyCapacitySnapshot(env, { actorId: user!.id })
    await audit(env.db, user!.id, 'capacity.snapshot', 'capacity', result.day, result.level)
    return context.json({ day: result.day, level: result.level, audited: result.audited, report: await capacityReport(env) })
  })
}
