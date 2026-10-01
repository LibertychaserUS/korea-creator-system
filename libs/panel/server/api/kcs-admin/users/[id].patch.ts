import { and, eq, ne } from 'drizzle-orm'
import { db, session, user } from '@libs/database'
import { roleFromIdentity } from '@kcs/contract'
import { accountError, parseRole, requireAccountAdmin } from '../../../utils/kcs-admin'
import { reportAccountAudit } from '../../../utils/admin-audit'

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

  // Last-admin guard: demoting or disabling an account must never leave the
  // identity database without a platform_admin — count the admins excluding
  // the target; zero left means this change would lock everyone out.
  const demotingAdmin = (role !== null && role !== 'platform_admin') || Boolean(wantsDisabled && body!.disabled)
  if (demotingAdmin) {
    const adminsLeft = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.role, 'platform_admin'), ne(user.id, id)))
    if (!adminsLeft.length) {
      accountError(409, 'last_admin: removing the last platform_admin would lock everyone out')
    }
  }

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
  const summaryParts: string[] = []
  if (role) summaryParts.push(`role=${role}`)
  if (wantsDisabled) summaryParts.push(`disabled=${body!.disabled}`)
  await reportAccountAudit(event, { action: 'account.update', target: updated.email, summary: summaryParts.join(', ') })
  return {
    id: updated.id,
    email: updated.email,
    name: updated.name || updated.email,
    role: roleFromIdentity(updated.role),
    disabled: Boolean(updated.banned),
  }
})
