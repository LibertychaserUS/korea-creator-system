import type { Paging } from '@kcs/contract'
import type { Db } from '../db'

/**
 * One page of a list plus the total before paging, in one round trip
 * (`count(*) OVER ()`); a page past the end falls back to a plain count.
 * `from` is everything after SELECT's column list, up to and including WHERE.
 */
export async function pageRows(
  db: Db,
  sql: { columns: string; from: string; order: string },
  params: unknown[],
  paging: Paging,
): Promise<{ rows: Array<Record<string, any>>; total: number }> {
  const limit = `$${params.length + 1}`
  const offset = `$${params.length + 2}`
  const { rows } = await db.query(
    `SELECT ${sql.columns}, count(*) OVER ()::int AS total_count ${sql.from}
      ORDER BY ${sql.order} LIMIT ${limit} OFFSET ${offset}`,
    [...params, paging.pageSize, paging.offset],
  )
  if (rows.length || paging.offset === 0) {
    return { rows, total: rows[0]?.total_count ?? 0 }
  }
  const counted = await db.query(`SELECT count(*)::int AS total ${sql.from}`, params)
  return { rows: [], total: counted.rows[0].total }
}

export function csv(raw: string | undefined): string[] {
  return raw ? raw.split(',').map((value) => value.trim()).filter(Boolean) : []
}
