import { eq } from 'drizzle-orm'
import { db, session, user } from '@libs/database'
import { roleFromIdentity } from '@kcs/contract'
import { accountError, parseRole, requireAccountAdmin } from '../../../utils/kcs-admin'

/**
 * 改角色 / 停用 / 恢复。停用会删掉这个账号现有的全部会话，已经打开的页面
 * 下一次校验就会掉线；API 侧对会话有 10 秒缓存，所以改角色和停用最多 10 秒后生效。
 */
export default defineEventHandler(async (event) => {
  const caller = await requireAccountAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await readBody(event).catch(() => null) as Record<string, unknown> | null
  const wantsRole = body?.role !== undefined
  const wantsDisabled = typeof body?.disabled === 'boolean'
  const role = wantsRole ? parseRole(body?.role) : null
  if (wantsRole && !role) accountError(400, 'invalid_role')
  if (!wantsRole && !wantsDisabled) accountError(400, 'nothing_to_change')
  if (id === caller.id) accountError(409, 'self')

  const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, id)).limit(1)
  if (!target) accountError(404, 'not_found')

  const changes: Partial<typeof user.$inferInsert> = { updatedAt: new Date() }
  if (role) changes.role = role
  if (wantsDisabled) {
    changes.banned = body!.disabled as boolean
    changes.banReason = body!.disabled ? 'disabled_by_admin' : null
    changes.banExpires = null
  }
  const [updated] = await db
    .update(user)
    .set(changes)
    .where(eq(user.id, id))
    .returning({ id: user.id, email: user.email, name: user.name, role: user.role, banned: user.banned })
  if (wantsDisabled && body!.disabled) await db.delete(session).where(eq(session.userId, id))
  return {
    id: updated.id,
    email: updated.email,
    name: updated.name || updated.email,
    role: roleFromIdentity(updated.role),
    disabled: Boolean(updated.banned),
  }
})
