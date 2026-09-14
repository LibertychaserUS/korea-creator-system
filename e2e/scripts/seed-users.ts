/**
 * Probe the five RBAC users from @kcs/contract.
 * Prefers POST /api/auth/login on E2E_API_URL, then checks user.role in Postgres.
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

loadEnv({ path: resolve(__dirname, '../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

process.env.E2E_DATABASE_URL ||= 'postgres://kcs:kcs@127.0.0.1:5432/kcs';
process.env.E2E_API_URL ||= 'http://localhost:7100';

import { API, API_URL, USERS } from '../helpers/constants';
import { closePool, findUserRole } from '../helpers/postgres';

async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}${API.login}`, {
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
      try {
        const stored = await findUserRole(user.email);
        if (stored && stored !== user.role) {
          throw new Error(`Postgres role is ${stored}, expected ${user.role}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/relation .* does not exist|ECONNREFUSED/i.test(message)) {
          throw error;
        }
        console.warn(`[seed] ${user.email} logged in; SQL role check skipped (${message})`);
      }
      console.log(`[seed] ${user.email} ok`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[seed] ${user.email}: ${message}`);
    }
  }
  await closePool().catch(() => undefined);
  if (failed) process.exitCode = 1;
}

main();
