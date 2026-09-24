import type { H3Event } from 'h3'

export const SESSION_COOKIE = 'kcs_session'

/**
 * `kcs_session` holds the TinyShip (better-auth) session token for the Hono
 * API. httpOnly: page scripts never see it — the browser sends it to the API
 * (`credentials: 'include'`) and SSR forwards it as `Authorization: Bearer`.
 * With AUTH_COOKIE_DOMAIN it is scoped to the parent domain, like better-auth's
 * own cookie, so every app and api. share one sign-in.
 */
export function sessionCookieOptions() {
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined
  return {
    path: '/',
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    ...(domain ? { domain } : {}),
  }
}

/**
 * With a parent-domain cookie in place, a host-only `kcs_session` left from an
 * earlier deployment would be sent first and shadow it; expire that one too.
 */
export function expireHostOnlySession(event: H3Event) {
  if (!process.env.AUTH_COOKIE_DOMAIN?.trim()) return
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  appendResponseHeader(event, 'set-cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`)
}
