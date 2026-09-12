import { can, type Role } from '@kcs/contract'

function homeFor(role: Role) {
  if (can(role, 'ops.read')) return '/ops'
  if (can(role, 'select.read')) return '/select'
  if (can(role, 'dev.read')) return '/dev'
  return '/denied'
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
  return sendRedirect(event, `/${locale}${homeFor(data.user.role)}`)
})
