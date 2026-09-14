import { ROLES, SEED_USERS, type Role } from './contract'
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
  const session: Session = { role, email, token: `dev:${email}` }
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
