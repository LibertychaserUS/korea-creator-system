import { z } from 'zod'
import { audit } from '../http/audit'
import { readJson } from '../http/body'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'

/**
 * 账号管理审计上报体。长度上限和 Nitro 侧的构造方式对应：action 形如
 * `account.create` / `account.update`，target 是账号邮箱。
 */
const adminAuditBody = z.looseObject({
  action: z.string().trim().min(1).max(80),
  target: z.string().trim().min(1).max(120),
  summary: z.string().max(500),
})

export function registerAuthRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/auth/me', async (context) => {
    const { user, denied } = await helpers.requireAuth(context)
    if (denied) return denied
    return context.json({ user })
  })

  /**
   * 账号管理（创建/改角色/停用）发生在工作端源站的 TinyShip 侧，Nitro 路由
   * 成功后把操作转发到这里落 audit_logs。只有 platform_admin（admin.users）
   * 能写；失败只影响审计记录本身，由调用方决定是否容忍。
   */
  app.post('/api/auth/admin-audit', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'admin.users')
    if (denied) return denied
    const { data, invalid } = await readJson(context, adminAuditBody)
    if (invalid) return invalid
    await audit(env.db, user!.id, data!.action, 'account', data!.target, data!.summary)
    return context.json({ ok: true }, 201)
  })
}
