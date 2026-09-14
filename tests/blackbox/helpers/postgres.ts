import pg from 'pg'

const DEFAULT_URL = 'postgres://kcs:kcs@127.0.0.1:5432/kcs'

export function databaseUrl(): string {
  return (
    process.env.BLACKBOX_DATABASE_URL ||
    process.env.DATABASE_URL ||
    DEFAULT_URL
  )
}

export function assertPostgresDialect(): string {
  const url = databaseUrl()
  if (/sqlite/i.test(url) || url.startsWith('file:')) {
    throw new Error(
      `black-box tests require PostgreSQL, got ${url}. ` +
        'Start `docker compose up -d postgres` and unset SQLITE_DB_PATH.',
    )
  }
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    throw new Error(`BLACKBOX_DATABASE_URL must be postgres://, got ${url}`)
  }
  return url
}

let pool: pg.Pool | undefined

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: assertPostgresDialect(), max: 2 })
  }
  return pool
}

export async function assertPostgresReachable(): Promise<void> {
  const url = assertPostgresDialect()
  const client = new pg.Client({ connectionString: url })
  try {
    await client.connect()
    const { rows } = await client.query('SELECT current_database() AS db, version() AS v')
    if (!/postgresql/i.test(String(rows[0]?.v ?? ''))) {
      throw new Error(`connected engine is not PostgreSQL: ${rows[0]?.v}`)
    }
  } catch (error) {
    throw new Error(
      `PostgreSQL not reachable at ${url}. Run: docker compose up -d postgres\n${String(error)}`,
    )
  } finally {
    await client.end().catch(() => undefined)
  }
}

/** Optional persistence probe — prefer GET APIs. */
export async function sqlRead<T extends pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, values)
  return result.rows
}

/**
 * Console knobs with no HTTP surface (source quota / rate, a job's resume time).
 * Only for arranging a scenario — never for asserting.
 */
export async function sqlExec(text: string, values: unknown[] = []): Promise<number> {
  const result = await getPool().query(text, values)
  return result.rowCount ?? 0
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = undefined
  }
}
