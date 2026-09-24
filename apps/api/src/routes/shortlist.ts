import { audit } from '../http/audit'
import { jsonError } from '../http/responses'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'

export function registerShortlistRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.delete('/api/select/shortlist/:creatorId', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const creatorId = context.req.param('creatorId')
    const removed = await env.db.query('DELETE FROM shortlist_items WHERE org_id = $1 AND creator_id = $2', [
      user!.orgId,
      creatorId,
    ])
    if (!removed.rowCount) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    await audit(env.db, user!.id, 'shortlist.remove', 'creator', creatorId, 'shortlist')
    return context.json({ ok: true })
  })
}
