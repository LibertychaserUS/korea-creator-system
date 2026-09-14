import type { Role } from './contract'

export type Session = {
  role: Role
  email: string
  token: string
}

/**
 * Identity is TinyShip (better-auth) served by the workspace apps. Sessions are
 * obtained the way a browser would: email + password against
 * `POST /api/auth/sign-in/email` on a workspace origin. No dev tokens.
 */
export const AUTH_URL = (
  process.env.BLACKBOX_AUTH_URL ||
  process.env.BLACKBOX_SELECT_URL ||
  'http://localhost:7004'
).replace(/\/$/, '')

export const AUTH = {
  signIn: '/api/auth/sign-in/email',
  signUp: '/api/auth/sign-up/email',
  signOut: '/api/auth/sign-out',
  getSession: '/api/auth/get-session',
  formLogin: '/__login',
  formLogout: '/__logout',
} as const

export type SignInResult = {
  status: number
  token: string | null
  user: { email?: string; role?: string; name?: string } | null
  code: string | undefined
  retryAfterMs: number | null
  headers: Headers
}

/** One sign-in attempt exactly as the browser sends it (JSON + Origin header). */
export async function signInEmail(
  email: string,
  password: string,
  opts: { origin?: string; base?: string } = {},
): Promise<SignInResult> {
  const base = (opts.base || AUTH_URL).replace(/\/$/, '')
  const res = await fetch(`${base}${AUTH.signIn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: opts.origin ?? base },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  })
  const raw = await res.text()
  let body: Record<string, unknown> = {}
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    body = { _text: raw }
  }
  const retryAfter = res.headers.get('x-retry-after') ?? res.headers.get('retry-after')
  return {
    status: res.status,
    token: typeof body.token === 'string' ? body.token : res.headers.get('set-auth-token'),
    user: (body.user as SignInResult['user']) ?? null,
    code: typeof body.code === 'string' ? body.code : undefined,
    retryAfterMs: retryAfter ? Number(retryAfter) * 1000 : null,
    headers: res.headers,
  }
}

/**
 * Sign in and wait through better-auth's per-IP throttle (3 sign-ins / 10 s)
 * instead of failing — the throttle is a product guarantee, not flakiness.
 */
export async function signInWithBackoff(email: string, password: string, attempts = 6): Promise<SignInResult> {
  let last = await signInEmail(email, password)
  for (let i = 1; i < attempts && last.status === 429; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(last.retryAfterMs ?? 4_000, 11_000) + 250))
    last = await signInEmail(email, password)
  }
  return last
}

/** `GET /api/auth/get-session` on the auth origin — `null` body once signed out. */
export async function getSession(token: string): Promise<{ status: number; user: Record<string, unknown> | null }> {
  const res = await fetch(`${AUTH_URL}${AUTH.getSession}`, { headers: { authorization: `Bearer ${token}` } })
  const raw = await res.text()
  let user: Record<string, unknown> | null = null
  try {
    const parsed = raw ? (JSON.parse(raw) as { user?: Record<string, unknown> } | null) : null
    user = parsed?.user ?? null
  } catch {
    user = null
  }
  return { status: res.status, user }
}

export async function signOut(token: string): Promise<number> {
  const res = await fetch(`${AUTH_URL}${AUTH.signOut}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, origin: AUTH_URL, 'content-type': 'application/json' },
    body: '{}',
  })
  return res.status
}
