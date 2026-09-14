import type { TestProject } from 'vitest/node'
import { AUTH_URL, signInWithBackoff, type Session } from './helpers/tinyship'
import { PATHS, ROLES, SEED_PASSWORD, SEED_USERS, type Role } from './helpers/contract'
import { BASE_URL, request } from './helpers/http'
import { assertPostgresReachable } from './helpers/postgres'

declare module 'vitest' {
  export interface ProvidedContext {
    sessions: Partial<Record<Role, Session>>
  }
}

/**
 * Sign the five seed accounts in once, the way the browser does (email +
 * password against TinyShip on the workspace origin), and hand the tokens to
 * every suite. Doing it here keeps the per-IP sign-in throttle (3 / 10 s) from
 * being paid by each test file.
 */
export default async function setup(project: TestProject) {
  await assertPostgresReachable()
  try {
    await request('GET', PATHS.health)
  } catch {
    console.warn(
      `[blackbox] API not reachable at ${BASE_URL} — cases will fail red until ` +
        'the HTTP API is up (docker compose --profile full, or apps/api on :7100).',
    )
  }

  const sessions: Partial<Record<Role, Session>> = {}
  for (const role of ROLES) {
    const email = SEED_USERS[role].email
    try {
      const result = await signInWithBackoff(email, SEED_PASSWORD)
      if (result.status === 200 && result.token) {
        sessions[role] = { role, email, token: result.token }
      } else {
        console.warn(`[blackbox] sign-in ${email} → HTTP ${result.status} ${result.code ?? ''}`)
      }
    } catch (error) {
      console.warn(`[blackbox] auth origin ${AUTH_URL} unreachable for ${email}: ${String(error)}`)
    }
  }
  project.provide('sessions', sessions)
}
