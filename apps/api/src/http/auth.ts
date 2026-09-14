import { can } from '@kcs/contract'
import type { Db } from '../db'
import { jsonError } from './responses'
import type { AppEnv, RouteHelpers, SessionUser } from './types'

export function bearer(header: string | undefined, cookie: string | undefined): string | undefined {
  if (header?.startsWith('Bearer ')) return header.slice(7)
  const match = cookie?.match(/(?:^|;\s*)kcs_session=([^;]+)/)
  return match?.[1]
}

async function readUser(db: Db, token: string): Promise<SessionUser | null> {
  const { rows } = await db.query(
    `SELECT u.id, u.org_id, u.email, u.role, u.display_name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token],
  )
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    orgId: row.org_id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
  }
}

export function createRouteHelpers(env: AppEnv): RouteHelpers {
  return {
    requireAuth: async (context, permission) => {
      const token = bearer(context.req.header('authorization'), context.req.header('cookie'))
      const user = token
        ? await (env.verifySession ? env.verifySession(token) : readUser(env.db, token))
        : null
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
