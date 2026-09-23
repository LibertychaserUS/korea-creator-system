import { inject } from 'vitest'
import { ROLES, SEED_PASSWORD, SEED_USERS, type Role } from './contract'
import { request, type ApiRes } from './http'
import { signInWithBackoff, type Session } from './tinyship'

export * from './tinyship'

const cache = new Map<Role, Session>()

/** Sessions minted once in global setup; falls back to a live sign-in. */
function provided(): Partial<Record<Role, Session>> {
  try {
    return (inject('sessions' as never) as Partial<Record<Role, Session>> | undefined) ?? {}
  } catch {
    return {}
  }
}

export async function login(role: Role): Promise<Session> {
  const hit = cache.get(role) ?? provided()[role]
  if (hit) {
    cache.set(role, hit)
    return hit
  }
  const email = SEED_USERS[role].email
  const result = await signInWithBackoff(email, SEED_PASSWORD)
  if (result.status !== 200 || !result.token) {
    throw new Error(`sign-in for ${email} failed: HTTP ${result.status} ${result.code ?? ''}`)
  }
  const session: Session = { role, email, token: result.token }
  cache.set(role, session)
  return session
}

export async function loginAll(): Promise<Record<Role, Session>> {
  const out = {} as Record<Role, Session>
  for (const role of ROLES) {
    out[role] = await login(role)
  }
  return out
}

export function authed(
  session: Session,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiRes> {
  return request(method, path, { token: session.token, body })
}

export function clearSessionCache(): void {
  cache.clear()
}

