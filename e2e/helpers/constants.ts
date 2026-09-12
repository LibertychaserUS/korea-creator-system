import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { SEED_PASSWORD, SEED_USERS, type Role } from '../../packages/kcs-contract/src/index.ts';

loadEnv({ path: resolve(__dirname, '../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

export const LOCALE = process.env.E2E_LOCALE || 'zh-CN';

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:7001';

export const API_URL = process.env.E2E_API_URL || 'http://localhost:7100';

export const PASSWORD = process.env.E2E_PASSWORD || SEED_PASSWORD;

export type SeedRole = Role;

export const USERS = Object.fromEntries(
  SEED_USERS.map((user) => [
    user.role,
    {
      role: user.role,
      email: user.email,
      name: user.displayName,
      password: PASSWORD,
    },
  ]),
) as Record<SeedRole, { role: SeedRole; email: string; name: string; password: string }>;

export const PAGES = {
  login: `/${LOCALE}/login`,
  ops: `/${LOCALE}/ops`,
  opsNew: `/${LOCALE}/ops/creators/new`,
  select: `/${LOCALE}/select`,
  selectNew: `/${LOCALE}/select/projects/new`,
  selectPool: `/${LOCALE}/select/pool`,
  dev: `/${LOCALE}/dev`,
  devJobs: `/${LOCALE}/dev/jobs`,
  home: `/${LOCALE}`,
} as const;

export const API = {
  login: '/api/auth/login',
  me: '/api/auth/me',
  assignments: (projectId: string) => `/api/select/projects/${projectId}/assignments`,
} as const;

export const TIMEOUTS = {
  navigation: 30_000,
  action: 15_000,
  sql: 10_000,
} as const;
