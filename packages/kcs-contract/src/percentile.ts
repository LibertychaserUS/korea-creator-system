/**
 * Cohort rank / percentile: a metric is only ever "good" relative to creators
 * in the same follower tier (蒲公英 / 千瓜 / 星图 all compare within tier).
 */

export function percentileRank(value: number, cohort: number[]): number {
  if (!cohort.length) return 0
  const below = cohort.filter((n) => n < value).length
  const equal = cohort.filter((n) => n === value).length
  return Number((((below + 0.5 * equal) / cohort.length) * 100).toFixed(1))
}

export function rankInCohort(value: number, cohort: number[]): number {
  if (!cohort.length) return 0
  return cohort.filter((n) => n > value).length + 1
}
