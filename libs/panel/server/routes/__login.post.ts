import { can, type Role } from '@kcs/contract'

/** Workspaces a role may open, in product order: 前台选人 / 后台录入 / 监控. */
function workspacesFor(role: Role): string[] {
  const ws: string[] = []
  if (can(role, 'select.read')) ws.push('select')
  if (can(role, 'ops.read')) ws.push('ops')
  if (can(role, 'dev.read')) ws.push('dev')
  return ws
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
  let locale = 'zh-CN'
  let appKey = ''
  if (contentType.includes('application/json')) {
    const body = await readBody(event)
    email = String(body?.email || '')
    password = String(body?.password || '')
    locale = String(body?.locale || 'zh-CN')
    appKey = String(body?.app || '')
  } else {
    const form = await readFormData(event)
    email = String(form.get('email') || '')
    password = String(form.get('password') || '')
    locale = String(form.get('locale') || 'zh-CN')
    appKey = String(form.get('app') || '')
  }
  const apiBase = useRuntimeConfig().public.apiBase || 'http://localhost:7100'
  const res = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = (await res.json()) as {
    token?: string
    user?: { role: Role }
  }
  if (!res.ok || !data.token || !data.user) {
    return sendRedirect(event, `/${locale}/login?error=1`)
  }
  setCookie(event, 'kcs_session', data.token, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  })

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
  const allowed = workspacesFor(data.user.role)
  const lastWorkspace = getCookie(event, 'kcs_last_ws') || undefined
  const target = (lastWorkspace && allowed.includes(lastWorkspace) ? lastWorkspace : allowed[0]) ?? null
  const base = target ? origins[target] : undefined
  if (!base) return sendRedirect(event, `/${locale}/denied`)
  return sendRedirect(event, `${base}/${locale}/`)
})
