import { can, roleFromIdentity, SEED_USERS } from '@kcs/contract'
import { jsonError } from './responses'
import type { AppEnv, RouteHelpers, SessionUser } from './types'

export function bearer(header: string | undefined, cookie: string | undefined): string | undefined {
  if (header?.startsWith('Bearer ')) return header.slice(7)
  const match = cookie?.match(/(?:^|;\s*)kcs_session=([^;]+)/)
  return match?.[1]
}

type CacheEntry = {
  expiresAt: number
  user: SessionUser | null
}

export function introspectTinyShip(env: AppEnv) {
  const cache = new Map<string, CacheEntry>()
  const authBaseUrl = (process.env.AUTH_BASE_URL || 'http://localhost:7004').replace(/\/$/, '')

  return async (token: string): Promise<SessionUser | null> => {
    const now = env.now().getTime()
    const cached = cache.get(token)
    if (cached && cached.expiresAt > now) return cached.user
    if (cached) cache.delete(token)

    const devUser = developmentToken(token)
    if (devUser) {
      await mirrorProfile(env, devUser)
      cache.set(token, { user: devUser, expiresAt: now + 30_000 })
      return devUser
    }

    let user: SessionUser | null = null
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
          user = {
            id: String(body.user.id),
            orgId: 'org_platform',
            email: String(body.user.email),
            role: roleFromIdentity(
              typeof body.user.role === 'string' ? body.user.role : null,
            ),
            displayName: String(body.user.name || body.user.email),
          }
          await mirrorProfile(env, user)
        }
      }
    } catch {
      user = null
    }

    cache.set(token, {
      user,
      expiresAt: now + (user ? 30_000 : 5_000),
    })
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
      const user = token ? await verifySession(token) : null
      if (!user) {
        return {
          user: null,
          denied: jsonError(context, 401, 'AUTH-LOGIN', 'unauthenticated'),
        }
      }
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
