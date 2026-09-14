import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { SEED_PASSWORD, SEED_USERS, type Role } from '../../packages/kcs-contract/src/index.ts';

loadEnv({ path: resolve(__dirname, '../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

export const LOCALE = process.env.E2E_LOCALE || 'zh-CN';

export const APP_URLS = {
  marketing: process.env.E2E_MARKETING_URL || 'http://localhost:7000',
  ops: process.env.E2E_OPS_URL || 'http://localhost:7002',
  dev: process.env.E2E_DEV_URL || 'http://localhost:7003',
  select: process.env.E2E_SELECT_URL || 'http://localhost:7004',
} as const;

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

function appPage(app: keyof typeof APP_URLS, path = '') {
  return `${APP_URLS[app].replace(/\/$/, '')}/${LOCALE}${path}`;
}

export const PAGES = {
  login: appPage('marketing', '/login'),
  ops: appPage('ops'),
  opsNew: appPage('ops', '/creators/new'),
  select: appPage('select', '/projects'),
  selectNew: appPage('select', '/projects/new'),
  selectPool: appPage('select'),
  dev: appPage('dev'),
  devJobs: appPage('dev', '/jobs'),
  home: appPage('marketing'),
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
