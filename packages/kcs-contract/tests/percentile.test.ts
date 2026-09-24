import { describe, expect, it } from 'vitest'
import { percentileRank, percentileTenths, rankInCohort } from '../src/percentile'
import { directedPercentileTenths, percentileFromCounts, RANKED_METRIC_KEYS } from '../src/metrics'

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

describe('integer percentile (SQL-reproducible)', () => {
  it('rounds exact .x5 boundaries half up, where float math used to drift down', () => {
    // 11.5 / 40 = 28.75 %; ((11.5 / 40) * 100).toFixed(1) gave 28.7
    expect(percentileTenths(11, 1, 40)).toBe(288)
    expect(percentileRank(5, [...Array(11).fill(1), 5, ...Array(28).fill(9)])).toBe(28.8)
  })

  it('matches (below + equal / 2) / n rounded half up to one decimal for every count', () => {
    for (let n = 1; n <= 300; n++) {
      for (let below = 0; below <= n; below++) {
        for (let equal = 0; below + equal <= n; equal += Math.max(1, Math.floor(n / 7))) {
          const exact = ((2 * below + equal) * 1000) / (2 * n)
          expect(percentileTenths(below, equal, n)).toBe(Math.floor(exact + 0.5))
        }
      }
    }
  })

  it('directed tenths invert low-is-better metrics and skip unranked keys / tiny cohorts', () => {
    expect(directedPercentileTenths('readMedian', 3, 1, 4)).toBe(875)
    expect(directedPercentileTenths('cpe', 3, 1, 4)).toBe(125)
    expect(directedPercentileTenths('followers', 3, 1, 4)).toBeNull()
    expect(directedPercentileTenths('readMedian', 0, 1, 1)).toBeNull()
    expect(percentileFromCounts('cpe', 0, 1, 4)).toEqual({ percentile: 87.5, band: 'front', n: 4 })
    expect(RANKED_METRIC_KEYS).not.toContain('followers')
    expect(RANKED_METRIC_KEYS).toContain('cpe')
  })
})
