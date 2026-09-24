import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectDb, type Db } from '../src/db'
import { MIGRATION_LOCK, migrate } from '../src/migrate'

const DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgres://kcs:kcs@127.0.0.1:5432/kcs_test'

describe('migrate', () => {
  let db: Db

  beforeAll(async () => {
    db = await connectDb(DB_URL)
    await migrate(db)
  })

  afterAll(async () => {
    await db.end()
  })

  it('two concurrent runs serialise on the advisory lock and apply each version once', async () => {
    const other = await connectDb(DB_URL)
    try {
      await Promise.all([migrate(db), migrate(other)])
    } finally {
      await other.end()
    }
    const { rows } = await db.query(
      'SELECT version, count(*)::int AS n FROM schema_migrations GROUP BY version HAVING count(*) > 1',
    )
    expect(rows).toEqual([])
    const held = await db.query(
      "SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = $1",
      [MIGRATION_LOCK],
    )
    expect(held.rowCount).toBe(0)
  })

  it('waits while another session holds the lock', async () => {
    const holder = await db.connect()
    await holder.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK])
    let done = false
    const run = migrate(db).then(() => {
      done = true
    })
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(done).toBe(false)
    await holder.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK])
    holder.release()
    await run
    expect(done).toBe(true)
  })

  it('list indexes exist', async () => {
    const { rows } = await db.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
    )
    const names = rows.map((row) => row.indexname)
    for (const name of [
      'creators_xhs_id_idx',
      'creators_status_idx',
      'creators_updated_idx',
      'creator_raw_creator_source_fetched_idx',
      'ingest_jobs_created_idx',
      'audit_logs_created_idx',
      'ingest_dead_letters_resolved_idx',
    ]) {
      expect(names).toContain(name)
    }
  })

  it('unused baseline objects are gone', async () => {
    const relations = await db.query(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN ('creator','assignment','ingest_job','price','project','creator_category','sessions','user')`,
    )
    expect(relations.rows).toEqual([])
    const columns = await db.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'creators' AND column_name IN ('er','locked_final')`,
    )
    expect(columns.rows).toEqual([])
    const fn = await db.query("SELECT 1 FROM pg_proc WHERE proname = 'kcs_sync_user_role'")
    expect(fn.rowCount).toBe(0)
  })

  it('0026 moves the old metric keys left in stored records and saved queries', async () => {
    const { readFile } = await import('node:fs/promises')
    const sql = await readFile(new URL('../src/migrations/0026_legacy_metric_keys.sql', import.meta.url), 'utf8')
    const id = `mig0026${Date.now().toString(36)}`
    await db.query(
      `INSERT INTO creators (id, creator_key, display_name, status, metrics, metrics_locked) VALUES
         ($1, $1, 'x', 'draft', '{"cpv": 0.2, "retentionRate": 0.4}', '{"cpv": 0.3, "cpr": 0.5}')`,
      [id],
    )
    await db.query(
      `INSERT INTO saved_queries (id, name, spec) VALUES
         ($1, 'q', '{"columns": ["followers", "cpv"], "sort": {"key": "retentionRate", "dir": "asc"}, "search": "cpv", "groups": [{"mode": "any", "filters": [{"key": "cpv", "op": "lte", "value": 1}]}], "highlights": [{"key": "health", "op": "eq", "value": "abnormal"}]}')`,
      [id],
    )
    try {
      await db.query(sql)
      await db.query(sql)
      const { rows: [creator] } = await db.query('SELECT metrics, metrics_locked FROM creators WHERE id = $1', [id])
      expect(creator.metrics).toEqual({ cpr: 0.2, completionRate: 0.4 })
      // A current value is never overwritten by an old one.
      expect(creator.metrics_locked).toEqual({ cpr: 0.5 })
      const { rows: [query] } = await db.query('SELECT spec FROM saved_queries WHERE id = $1', [id])
      expect(query.spec).toEqual({
        columns: ['followers', 'cpr'],
        sort: { key: 'completionRate', dir: 'asc' },
        search: 'cpv',
        groups: [{ mode: 'any', filters: [{ key: 'cpr', op: 'lte', value: 1 }] }],
        highlights: [{ key: 'health', op: 'eq', value: 'abnormal' }],
      })
    } finally {
      await db.query('DELETE FROM saved_queries WHERE id = $1', [id])
      await db.query('DELETE FROM creators WHERE id = $1', [id])
    }
  })

  it('the cleanup migration is idempotent on an already-clean database', async () => {
    const { readFile } = await import('node:fs/promises')
    const sql = await readFile(new URL('../src/migrations/0011_drop_unused_legacy.sql', import.meta.url), 'utf8')
    await db.query(sql)
    await db.query(sql)
  })
})
