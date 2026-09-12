import pg from 'pg'

export type Db = pg.Pool

export async function connectDb(url: string): Promise<Db> {
  const pool = new pg.Pool({ connectionString: url })
  await pool.query('select 1')
  return pool
}
