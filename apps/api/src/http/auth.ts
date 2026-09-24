import { can, roleFromIdentity, SEED_USERS } from '@kcs/contract'
import { jsonError } from './responses'
import { SessionCache } from './session-cache'
import type { AppEnv, RouteHelpers, SessionUser, VerifiedIdentity } from './types'

/**
 * The session token: `Authorization: Bearer` (SSR, scripts) first, else the
 * httpOnly `kcs_session` cookie the browser sends with `credentials: 'include'`.
 */
export function bearer(header: string | undefined, cookie: string | undefined): string | undefined {
  if (header?.startsWith('Bearer ')) return header.slice(7)
  const match = cookie?.match(/(?:^|;\s*)kcs_session=([^;]+)/)
  if (!match?.[1]) return undefined
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

/**
 * Positive introspection results are cached briefly so a page full of
 * requests costs one round-trip to TinyShip. The TTL also bounds how long a
 * signed-out session keeps working here — keep it short. The entry cap keeps a
 * flood of random tokens from growing the process without bound.
 */
const SESSION_CACHE_MS = Number(process.env.SESSION_CACHE_MS || 10_000)
const SESSION_CACHE_MAX = Math.max(1, Number(process.env.SESSION_CACHE_MAX) || 5_000)
const MISS_CACHE_MS = 5_000
const SWEEP_MS = 60_000

export function introspectTinyShip(env: AppEnv) {
  const cache = new SessionCache<VerifiedIdentity>(SESSION_CACHE_MAX)
  setInterval(() => cache.sweep(env.now().getTime()), SWEEP_MS).unref()
  const authBaseUrl = (process.env.AUTH_BASE_URL || 'http://localhost:7004').replace(/\/$/, '')

  return async (token: string): Promise<VerifiedIdentity> => {
    const now = env.now().getTime()
    const cached = cache.get(token, now)
    if (cached) return cached.value

    const devUser = developmentToken(token)
    if (devUser) {
      await mirrorProfile(env, devUser)
      cache.set(token, devUser, now + SESSION_CACHE_MS)
      return devUser
    }

    let user: VerifiedIdentity = null
    try {
      const response = await fetch(`${authBaseUrl}/api/auth/get-session`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5_000),
      })
      if (response.ok) {
        const body = await response.json() as {
          user?: { id?: unknown; email?: unknown; role?: unknown; name?: unknown }
        } | null
        if (body?.user?.id && body.user.email) {
          const role = roleFromIdentity(typeof body.user.role === 'string' ? body.user.role : null)
          user = {
            id: String(body.user.id),
            orgId: 'org_platform',
            email: String(body.user.email),
            role,
            displayName: String(body.user.name || body.user.email),
          }
          // Only accounts with a KCS job are mirrored; strangers stay out of `users`.
          if (role) await mirrorProfile(env, { ...user, role })
        }
      }
    } catch {
      user = null
    }

    cache.set(token, user, now + (user ? SESSION_CACHE_MS : MISS_CACHE_MS))
    return user
  }
}

function developmentToken(token: string): SessionUser | null {
  if (process.env.KCS_DEV_TOKENS !== '1' || process.env.NODE_ENV === 'production') return null
  if (!token.startsWith('dev:')) return null
  const email = token.slice(4)
  const seed = SEED_USERS.find((candidate) => candidate.email === email)
  if (!seed) return null
  return {
    id: `user_${seed.role}`,
    orgId: 'org_platform',
    email: seed.email,
    role: seed.role,
    displayName: seed.displayName,
  }
}

async function mirrorProfile(env: AppEnv, user: SessionUser) {
  await env.db.query(
    `INSERT INTO orgs (id, name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
    [user.orgId, 'Platform'],
  )
  await env.db.query(
    `INSERT INTO users (id, org_id, email, role, display_name)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (email) DO UPDATE SET
       id = EXCLUDED.id,
       org_id = EXCLUDED.org_id,
       role = EXCLUDED.role,
       display_name = EXCLUDED.display_name`,
    [user.id, user.orgId, user.email, user.role, user.displayName],
  )
}

export function createRouteHelpers(env: AppEnv): RouteHelpers {
  const verifySession = env.verifySession ?? introspectTinyShip(env)
  return {
    requireAuth: async (context, permission) => {
      const token = bearer(context.req.header('authorization'), context.req.header('cookie'))
      const identity = token ? await verifySession(token) : null
      if (!identity) {
        return {
          user: null,
          denied: jsonError(context, 401, 'AUTH-LOGIN', 'unauthenticated'),
        }
      }
      if (!identity.role) {
        // Signed in to TinyShip, but nobody has given this account a KCS job yet.
        return {
          user: null,
          denied: jsonError(context, 403, 'AUTH-DENIED', 'no role assigned'),
        }
      }
      const user: SessionUser = { ...identity, role: identity.role }
      if (permission && !can(user.role, permission)) {
        return {
          user,
          denied: jsonError(context, 403, 'AUTH-DENIED', 'forbidden'),
        }
      }
      return { user, denied: null }
    },
  }
}
