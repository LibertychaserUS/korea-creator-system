import { auth } from '@libs/auth'
import { defaultLocale, isValidLocale } from '@libs/i18n'
import { can, roleFromIdentity, type Role } from '@kcs/contract'

/** Workspaces a role may open, in product order: 前台选人 / 后台录入 / 监控. */
function workspacesFor(role: Role): string[] {
  const ws: string[] = []
  if (can(role, 'select.read')) ws.push('select')
  if (can(role, 'ops.read')) ws.push('ops')
  if (can(role, 'dev.read')) ws.push('dev')
  return ws
}

/**
 * The locale ends up as the first segment of every `Location` we send, so only
 * the three product locales get through; anything else (`/evil.example.com`,
 * `\\evil`, …) falls back to the default instead of becoming `//host/...`.
 */
function safeLocale(raw: unknown): string {
  const value = typeof raw === 'string' ? raw : ''
  return isValidLocale(value) ? value : defaultLocale
}

/**
 * 登录后落点（四端各自独立源站）：
 * - 在工作端（select/ops/dev）登录 → 落在本端首页 `/${locale}/`。
 * - 在宣传站（marketing）登录 → 按角色交接给对应工作端源站；
 *   多工作区角色优先尊重 kcs_last_ws（受同意门控写入）。
 */
export default defineEventHandler(async (event) => {
  const contentType = getHeader(event, 'content-type') || ''
  let email = ''
  let password = ''
  let rawLocale: unknown = defaultLocale
  let appKey = ''
  try {
    if (contentType.includes('application/json')) {
      const body = await readBody(event)
      email = String(body?.email || '')
      password = String(body?.password || '')
      rawLocale = body?.locale
      appKey = String(body?.app || '')
    } else {
      const form = await readFormData(event)
      email = String(form.get('email') || '')
      password = String(form.get('password') || '')
      rawLocale = form.get('locale')
      appKey = String(form.get('app') || '')
    }
  } catch {
    return sendRedirect(event, `/${defaultLocale}/login?error=1`)
  }
  const locale = safeLocale(rawLocale)
  let response: Response
  try {
    response = await auth.api.signInEmail({
      body: { email, password },
      headers: new Headers(
        Object.entries(getRequestHeaders(event))
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      ),
      asResponse: true,
    })
  } catch {
    return sendRedirect(event, `/${locale}/login?error=1`)
  }
  const data = await response.clone().json().catch(() => null) as {
    token?: string
    user?: { role?: string }
  } | null
  const token = data?.token || response.headers.get('set-auth-token')
  if (!response.ok || !token || !data?.user) {
    return sendRedirect(event, `/${locale}/login?error=1`)
  }
  for (const cookie of response.headers.getSetCookie()) {
    appendResponseHeader(event, 'set-cookie', cookie)
  }
  expireHostOnlySession(event)
  setCookie(event, SESSION_COOKIE, token, sessionCookieOptions())
  const role = roleFromIdentity(data.user.role)
  // Account exists in TinyShip but has no KCS job yet: signed in, nowhere to go.
  if (!role) return sendRedirect(event, `/${locale}/denied`)

  // Workspace apps: land on the app's own home; the route middleware
  // re-checks this app's perm and sends misuse to /denied.
  if (appKey && appKey !== 'marketing') {
    return sendRedirect(event, `/${locale}/`)
  }

  // Marketing hands off to the role's workspace origin.
  const pub = useRuntimeConfig().public
  const origins: Record<string, string | undefined> = {
    select: pub.selectUrl as string | undefined,
    ops: pub.opsUrl as string | undefined,
    dev: pub.devUrl as string | undefined,
  }
  const allowed = workspacesFor(role)
  const lastWorkspace = getCookie(event, 'kcs_last_ws') || undefined
  const target = (lastWorkspace && allowed.includes(lastWorkspace) ? lastWorkspace : allowed[0]) ?? null
  const base = target ? origins[target]?.replace(/\/+$/, '') : undefined
  if (!base || !/^https?:\/\/[^/]/.test(base)) return sendRedirect(event, `/${locale}/denied`)
  return sendRedirect(event, `${base}/${locale}/`)
})
