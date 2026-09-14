import { readdir, readFile } from 'node:fs/promises'
import type { Db } from './db'

const MIGRATIONS_URL = new URL('./migrations/', import.meta.url)
const MIGRATION_NAME = /^\d{4}_[a-z0-9_-]+\.sql$/

export async function migrate(db: Db): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const files = (await readdir(MIGRATIONS_URL))
    .filter((name) => MIGRATION_NAME.test(name))
    .sort()

  for (const file of files) {
    const applied = await db.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file])
    if (applied.rowCount) continue
    const sql = await readFile(new URL(file, MIGRATIONS_URL), 'utf8')
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
