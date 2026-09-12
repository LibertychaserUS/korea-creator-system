/**
 * Cohort rank / percentile are display-only.
 * scoreCreator stays a single-row pure function so the same input always
 * yields the same final/grade (no hidden dependency on who else is in the pool).
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
