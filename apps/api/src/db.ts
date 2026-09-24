import pg from 'pg'

// A `date` column is a calendar day, not an instant: keep 'YYYY-MM-DD' instead of a
// local-midnight Date that shifts a day when serialised in another time zone.
pg.types.setTypeParser(1082, (value: string) => value)

export type Db = pg.Pool

/** A pool or a checked-out client: anything that can run a statement. */
export type Queryable = Pick<pg.Pool | pg.PoolClient, 'query'>

export async function connectDb(url: string): Promise<Db> {
  const pool = new pg.Pool({ connectionString: url })
  await pool.query('select 1')
  return pool
}
