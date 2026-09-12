import { closePool } from './helpers/postgres';

export default async function globalTeardown() {
  try {
    await closePool();
  } catch {
    // pool may never have opened
  }
}
