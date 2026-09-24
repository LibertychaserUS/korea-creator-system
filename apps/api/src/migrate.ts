import { readdir, readFile } from 'node:fs/promises'
import type { Db } from './db'

const MIGRATIONS_URL = new URL('./migrations/', import.meta.url)
const MIGRATION_NAME = /^\d{4}_[a-z0-9_-]+\.sql$/

// Session-level lock shared by every replica: the second one to start waits
// here, then finds the versions already applied and runs nothing.
export const MIGRATION_LOCK = 4_912_734

export async function migrate(db: Db): Promise<void> {
  const files = (await readdir(MIGRATIONS_URL))
    .filter((name) => MIGRATION_NAME.test(name))
    .sort()

  const client = await db.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK])
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      for (const file of files) {
        const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file])
        if (applied.rowCount) continue
        const sql = await readFile(new URL(file, MIGRATIONS_URL), 'utf8')
        try {
          await client.query('BEGIN')
          await client.query(sql)
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
          await client.query('COMMIT')
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK])
    }
  } finally {
    client.release()
  }
}
