import type { Db } from '../db'

/**
 * Fuzzy nickname search over `creators.name_grams` (migration 0051): Chinese
 * and Korean character bigrams, Hangul jamo and initial consonants, and a
 * spelling-tolerant romanisation. A name matches when it contains the
 * normalised query outright, or at least `minScore` of the query's grams.
 */
export const NAME_SEARCH_MIN_SCORE = 0.5

/**
 * The same match as SQL pieces, for another list to filter / sort on
 * (e.g. the pool): `param` is the placeholder holding the raw query text.
 * `where` uses the GIN index on `name_grams`.
 */
export function nameMatchSql(alias: string, param: string, minScore = NAME_SEARCH_MIN_SCORE) {
  const contains = `(kcs_name_norm(${param}) <> '' AND strpos(${alias}.name_norm, kcs_name_norm(${param})) > 0)`
  const score = `kcs_name_score(${alias}.name_grams, kcs_name_grams(${param}))`
  return {
    where: `${alias}.name_grams && kcs_name_grams(${param}) AND (${contains} OR ${score} >= ${Number(minScore)})`,
    contains,
    score,
    order: `${contains} DESC, ${score} DESC`,
  }
}

export type NameHit = {
  id: string
  displayName: string
  xhsId: string | null
  status: string
  followers: number | null
  /** The name contains the query as typed (after dropping spaces, punctuation, case). */
  exact: boolean
  score: number
}

export async function searchCreatorNames(
  db: Db,
  query: string,
  options: { limit?: number; statuses?: string[]; minScore?: number } = {},
): Promise<NameHit[]> {
  const text = query.trim()
  if (!text) return []
  const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 20)))
  const match = nameMatchSql('c', '$1', options.minScore ?? NAME_SEARCH_MIN_SCORE)
  const params: unknown[] = [text, limit]
  let statusFilter = ''
  if (options.statuses?.length) {
    params.push(options.statuses)
    statusFilter = `AND c.status = ANY($${params.length}::text[])`
  }
  const { rows } = await db.query(
    `SELECT c.id, c.display_name, c.xhs_id, c.status, c.followers,
            ${match.contains} AS exact, ${match.score} AS score
       FROM creators c
      WHERE ${match.where} ${statusFilter}
      ORDER BY ${match.order}, c.followers DESC NULLS LAST, c.id
      LIMIT $2`,
    params,
  )
  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    xhsId: row.xhs_id ?? null,
    status: row.status,
    followers: row.followers == null ? null : Number(row.followers),
    exact: Boolean(row.exact),
    score: Math.round(Number(row.score) * 1000) / 1000,
  }))
}
