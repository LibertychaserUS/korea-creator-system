import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { defineConfig, devices } from '@playwright/test';

loadEnv({ path: resolve(__dirname, '../.env') });
loadEnv({ path: resolve(__dirname, '.env') });

process.env.E2E_MARKETING_URL ||= 'http://localhost:7000';
process.env.E2E_OPS_URL ||= 'http://localhost:7002';
process.env.E2E_DEV_URL ||= 'http://localhost:7003';
process.env.E2E_SELECT_URL ||= 'http://localhost:7004';
process.env.E2E_API_URL ||= 'http://localhost:7100';
process.env.E2E_DATABASE_URL ||= 'postgres://kcs:kcs@127.0.0.1:5432/kcs';
process.env.E2E_S3_ENDPOINT ||= 'http://127.0.0.1:9000';
process.env.E2E_S3_BUCKET ||= 'kcs-assets';
process.env.E2E_S3_ACCESS_KEY ||= 'kcsminio';
process.env.E2E_S3_SECRET_KEY ||= 'kcsminio123';

const baseURL = process.env.E2E_MARKETING_URL;

/**
 * KCS product journeys. Chromium only (PRD chrome smoke).
 * Start web+api yourself or use `pnpm test:e2e:compose`.
 * No webServer here — the composed stack is Postgres + MinIO + app, not a lone Vite process.
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '../test-results/kcs-e2e-report' }],
  ],
  outputDir: '../test-results/kcs-e2e-output',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: 'zh-CN',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
