import { ROLES, SEED_PASSWORD, SEED_USERS, type Role } from './contract'
import { PATHS } from './contract'
import { request, type ApiRes } from './http'

export type Session = {
  role: Role
  email: string
  token: string
}

const cache = new Map<Role, Session>()

export async function login(role: Role): Promise<Session> {
  const hit = cache.get(role)
  if (hit) return hit
  const email = SEED_USERS[role].email
  const res = await request('POST', PATHS.login, {
    body: { email, password: SEED_PASSWORD },
  })
  if (res.status !== 200 || typeof res.json.token !== 'string') {
    throw new Error(
      `sign-in ${email} failed HTTP ${res.status}: ${res.raw.slice(0, 300)}. ` +
        'Seed the five RBAC users (see tests/blackbox/README.md).',
    )
  }
  const user = (res.json.user ?? {}) as { role?: string; email?: string }
  if (user.role && user.role !== role) {
    throw new Error(`login ${email} returned role ${user.role}, expected ${role}`)
  }
  const session: Session = { role, email, token: res.json.token as string }
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
