/**
 * Probe the five TinyShip identities through a workspace better-auth endpoint.
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

loadEnv({ path: resolve(__dirname, '../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

import { API, AUTH_URL, USERS } from '../helpers/constants';

async function login(email: string, password: string) {
  const res = await fetch(`${AUTH_URL}${API.login}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.status;
}

async function main() {
  let failed = 0;
  for (const user of Object.values(USERS)) {
    try {
      const status = await login(user.email, user.password);
      if (status !== 200) {
        throw new Error(`POST ${API.login} → HTTP ${status}`);
      }
      console.log(`[seed] ${user.email} ok`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[seed] ${user.email}: ${message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

main();
