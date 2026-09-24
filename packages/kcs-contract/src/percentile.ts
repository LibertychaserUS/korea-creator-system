/**
 * Cohort rank / percentile: a metric is only ever "good" relative to creators
 * in the same follower tier (蒲公英 / 千瓜 / 星图 all compare within tier).
 */

/**
 * Percentile in tenths, rounded half up, from counts inside the cohort:
 * `below` values strictly lower, `equal` values tied (the target included),
 * `n` non-null values. Pure integer math, so SQL (`rank()` / `count()` window
 * functions) reproduces it exactly — no float artefacts at .x5 boundaries.
 */
export function percentileTenths(below: number, equal: number, n: number): number {
  if (n <= 0) return 0
  return Math.floor((1000 * (2 * below + equal) + n) / (2 * n))
}

export function percentileRank(value: number, cohort: number[]): number {
  if (!cohort.length) return 0
  const below = cohort.filter((n) => n < value).length
  const equal = cohort.filter((n) => n === value).length
  return percentileTenths(below, equal, cohort.length) / 10
}

export function rankInCohort(value: number, cohort: number[]): number {
  if (!cohort.length) return 0
  return cohort.filter((n) => n > value).length + 1
}
