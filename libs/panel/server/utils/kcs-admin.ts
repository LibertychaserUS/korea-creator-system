import type { H3Event } from 'h3'
import { auth } from '@libs/auth'
import { can, roleFromIdentity, ROLES, type Role } from '@kcs/contract'

/**
 * 账号管理只在工作端源站上跑（身份就在这里的 TinyShip），不经过 Hono API。
 * 调用方必须是 platform_admin：会话从 `Authorization: Bearer`、httpOnly 的
 * kcs_session 或 better-auth 自己的 cookie 里取，每次请求都现查库，不走缓存。
 */
export async function requireAccountAdmin(event: H3Event) {
  const headers = new Headers(
    Object.entries(getRequestHeaders(event))
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
  const mirror = getCookie(event, SESSION_COOKIE)
  if (!headers.has('authorization') && mirror) headers.set('authorization', `Bearer ${mirror}`)
  const session = await auth.api.getSession({ headers }).catch(() => null)
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  const role = roleFromIdentity((session.user as { role?: string | null }).role)
  if (!role || !can(role, 'admin.users')) throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  return { id: session.user.id, role }
}

export function parseRole(raw: unknown): Role | null {
  return typeof raw === 'string' && (ROLES as readonly string[]).includes(raw) ? (raw as Role) : null
}

export function accountError(statusCode: number, code: string): never {
  throw createError({ statusCode, statusMessage: code, data: { error: code } })
}

export const MIN_PASSWORD_LENGTH = 8
