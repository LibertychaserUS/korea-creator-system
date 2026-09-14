import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { spawnSync } from 'child_process';
import { ensureBucket } from './helpers/s3';

loadEnv({ path: resolve(__dirname, '../.env') });
loadEnv({ path: resolve(__dirname, '.env') });

process.env.E2E_DATABASE_URL ||= 'postgres://kcs:kcs@127.0.0.1:5432/kcs';
process.env.E2E_API_URL ||= 'http://localhost:7100';
process.env.E2E_S3_ENDPOINT ||= 'http://127.0.0.1:9000';
process.env.E2E_S3_BUCKET ||= 'kcs-assets';
process.env.E2E_S3_ACCESS_KEY ||= 'kcsminio';
process.env.E2E_S3_SECRET_KEY ||= 'kcsminio123';

export default async function globalSetup() {
  try {
    await ensureBucket();
    console.log('[e2e] MinIO bucket ready');
  } catch (error) {
    console.warn('[e2e] MinIO bucket not ready — image journey stays red:', error);
  }

  const seed = spawnSync('pnpm', ['exec', 'tsx', 'e2e/scripts/seed-users.ts'], {
    cwd: resolve(__dirname, '..'),
    encoding: 'utf8',
    env: process.env,
  });
  if (seed.stdout) process.stdout.write(seed.stdout);
  if (seed.stderr) process.stderr.write(seed.stderr);
  if (seed.status !== 0) {
    console.warn(
      '[e2e] seed-users exited non-zero — journeys will stay red until API + Postgres accept the 5 roles.',
    );
  }
}
