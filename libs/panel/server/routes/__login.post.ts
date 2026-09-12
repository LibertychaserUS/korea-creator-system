import { can, type Role } from '@kcs/contract'

/** Workspaces a role may open, in product order: 前台选人 / 后台录入 / 监控. */
function workspacesFor(role: Role): string[] {
  const ws: string[] = []
  if (can(role, 'select.read')) ws.push('select')
  if (can(role, 'ops.read')) ws.push('ops')
  if (can(role, 'dev.read')) ws.push('dev')
  return ws
}

function homeFor(role: Role, lastWorkspace?: string) {
  const allowed = workspacesFor(role)
  if (allowed.length === 0) return '/denied'
  if (allowed.length === 1) return `/${allowed[0]}`
  // Multi-workspace roles (admin): last used workspace, else the chooser home.
  if (lastWorkspace && allowed.includes(lastWorkspace)) return `/${lastWorkspace}`
  return '/'
}

export default defineEventHandler(async (event) => {
  const contentType = getHeader(event, 'content-type') || ''
  let email = ''
  let password = ''
  let locale = 'zh-CN'
  if (contentType.includes('application/json')) {
    const body = await readBody(event)
    email = String(body?.email || '')
    password = String(body?.password || '')
    locale = String(body?.locale || 'zh-CN')
  } else {
    const form = await readFormData(event)
    email = String(form.get('email') || '')
    password = String(form.get('password') || '')
    locale = String(form.get('locale') || 'zh-CN')
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
  const lastWorkspace = getCookie(event, 'kcs_last_ws') || undefined
  return sendRedirect(event, `/${locale}${homeFor(data.user.role, lastWorkspace)}`)
})
