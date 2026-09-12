import { PATHS } from './helpers/contract'
import { BASE_URL, request } from './helpers/http'
import { assertPostgresReachable } from './helpers/postgres'

export default async function setup() {
  await assertPostgresReachable()
  try {
    await request('GET', PATHS.health)
  } catch {
    console.warn(
      `[blackbox] API not reachable at ${BASE_URL} — cases will fail red until ` +
        'the HTTP API is up (docker compose --profile full, or apps/api on :7100).',
    )
  }
}
