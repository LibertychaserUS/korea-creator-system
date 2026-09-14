import { describe, expect, it } from 'vitest'
import { percentileRank, rankInCohort } from '../src/percentile'

/**
 * Break: A-score-preview still shows only single-row grades with no
 * cohort-relative percentile next to the locked final.
 */
describe('cohort-relative percentile', () => {
  it('returns the midpoint percentile of a value inside its cohort', () => {
    expect(percentileRank(80, [60, 70, 80, 90])).toBe(62.5)
    expect(percentileRank(90, [60, 70, 80, 90])).toBe(87.5)
    expect(percentileRank(60, [60, 70, 80, 90])).toBe(12.5)
  })

  it('is 0 for an empty cohort and 50 for a single-value cohort', () => {
    expect(percentileRank(80, [])).toBe(0)
    expect(percentileRank(80, [80])).toBe(50)
  })

  it('ranks higher scores first (mockup #7 / #12 style)', () => {
    expect(rankInCohort(90, [60, 70, 80, 90])).toBe(1)
    expect(rankInCohort(70, [60, 70, 80, 90])).toBe(3)
    expect(rankInCohort(10, [])).toBe(0)
  })
})
