import pg from 'pg'

export type Db = pg.Pool

/** A pool or a checked-out client: anything that can run a statement. */
export type Queryable = Pick<pg.Pool | pg.PoolClient, 'query'>

export async function connectDb(url: string): Promise<Db> {
  const pool = new pg.Pool({ connectionString: url })
  await pool.query('select 1')
  return pool
}
