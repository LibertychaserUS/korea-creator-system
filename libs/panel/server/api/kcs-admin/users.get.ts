import { desc, max } from 'drizzle-orm'
import { db, session, user } from '@libs/database'
import { roleFromIdentity } from '@kcs/contract'
import { requireAccountAdmin } from '../../utils/kcs-admin'

/**
 * 最近登录 = 该账号还留在库里的会话里最新的一次创建时间。
 * 主动退出会删掉那次会话，所以它是「最近一次还没退出的登录」，没有就显示「—」。
 */
export default defineEventHandler(async (event) => {
  const caller = await requireAccountAdmin(event)
  const [accounts, sessions] = await Promise.all([
    db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt)),
    db
      .select({ userId: session.userId, lastLoginAt: max(session.createdAt) })
      .from(session)
      .groupBy(session.userId),
  ])
  const lastLogin = new Map(sessions.map((row) => [row.userId, row.lastLoginAt]))
  return {
    items: accounts.map((account) => ({
      id: account.id,
      email: account.email,
      name: account.name || account.email,
      role: roleFromIdentity(account.role),
      disabled: Boolean(account.banned),
      self: account.id === caller.id,
      createdAt: toIso(account.createdAt),
      lastLoginAt: toIso(lastLogin.get(account.id) ?? null),
    })),
  }
})

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}
