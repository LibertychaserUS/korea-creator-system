import { describe, expect, it } from 'vitest'
import {
  COHORT_RULES,
  calibrateSample,
  cohortGroupKey,
  cohortWindow,
  isStale,
  parseCohortGroupKey,
  rankAgainst,
  rankGroup,
  rankValue,
  referenceLines,
  wilsonLowerBound,
  type CohortMember,
} from '../src/cohort'
import { emptyMetrics, type CreatorMetrics } from '../src/metrics'

function member(id: string, followers: number | null, m: Partial<CreatorMetrics>, stale = false): CohortMember {
  return { id, followers, metrics: { ...emptyMetrics(30), followers, ...m }, stale }
}

function lcg(seed: number) {
  let s = seed
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2 ** 31
    return s / 2 ** 31
  }
}

describe('cohort engine', () => {
  it('group key round-trips; a missing source or form is its own group', () => {
    const key = cohortGroupKey({ source: null, window: 90, contentForm: 'video' })
    expect(key).toBe('-|90|video')
    expect(parseCohortGroupKey(key)).toEqual({ source: null, window: 90, contentForm: 'video' })
    expect(parseCohortGroupKey('pugongying|30|-')).toEqual({ source: 'pugongying', window: 30, contentForm: null })
  })

  it('the sliding window gives exactly what counting each creator directly gives', () => {
    const random = lcg(11)
    const pick = <T,>(values: readonly T[]) => values[Math.floor(random() * values.length)]
    for (const target of [10, 30, 97]) {
      const members = Array.from({ length: 400 }, (_, i) =>
        member(`c${String(i).padStart(3, '0')}`, pick([null, 300, 800, 4_000, 5_000, 12_000, 49_999, 50_000, 120_000, 600_000, 2_000_000]), {
          readMedian: pick([null, 800, 800, 1_200, 5_000, 20_000]),
          interactionMedian: pick([null, 20, 40, 40, 300]),
          cpe: pick([null, 1.5, 2.5, 2.5, 3, 9]),
          noteCount: pick([null, 3, 10, 40]),
          viralCount: pick([null, 0, 1, 2]),
        }, random() < 0.05))
      const ranked = rankGroup(members, { target, keys: ['readMedian', 'cpe', 'viralRate', 'interactionMedian'] })
      for (const m of members) {
        const direct = rankAgainst(members, m, { target, keys: ['readMedian', 'cpe', 'viralRate', 'interactionMedian'] })
        expect(ranked.get(m.id) ?? {}, m.id).toEqual(direct)
      }
    }
  })

  it('windows only move right, stay within one decade, and hold the target when they can', () => {
    const xs = Array.from({ length: 300 }, (_, i) => Math.log10(1_000 + i * i * 37)).sort((a, b) => a - b)
    let prev: [number, number] = [0, 0]
    for (let i = 0; i < xs.length; i += 1) {
      const [lo, hi] = cohortWindow(xs, i, 50, 1)
      expect(lo).toBeLessThanOrEqual(i)
      expect(hi).toBeGreaterThanOrEqual(i)
      expect(lo).toBeGreaterThanOrEqual(prev[0])
      expect(hi).toBeGreaterThanOrEqual(prev[1])
      expect(xs[hi] - xs[lo]).toBeLessThanOrEqual(1 + 1e-12)
      expect(hi - lo + 1).toBeLessThanOrEqual(50)
      prev = [lo, hi]
    }
  })

  it('creators far apart in size are not compared', () => {
    const small = Array.from({ length: 20 }, (_, i) => member(`s${i}`, 2_000 + i, { readMedian: 100 + i }))
    const big = Array.from({ length: 20 }, (_, i) => member(`b${i}`, 800_000 + i, { readMedian: 50_000 + i }))
    const ranked = rankGroup([...small, ...big], { target: 97 })
    expect(ranked.get('s19')!.readMedian!.n).toBe(20)
    expect(ranked.get('s19')!.readMedian!.followersMax).toBe(2_019)
    expect(ranked.get('b0')!.readMedian!.percentile).toBe(2.5)
  })

  it('sample size decides what is said: none below 10, three bands to 29, five from 30', () => {
    const cohort = (n: number) => Array.from({ length: n }, (_, i) => member(`n${n}_${i}`, 10_000 + i, { readMedian: 100 + i }))
    expect(rankGroup(cohort(9), { target: 97 }).get('n9_8')).toBeUndefined()
    const ten = rankGroup(cohort(10), { target: 97 })
    expect(ten.get('n10_9')!.readMedian).toMatchObject({ band: 'front', n: 10, scope: 'library' })
    expect(ten.get('n10_0')!.readMedian!.band).toBe('back')
    const thirty = rankGroup(cohort(30), { target: 97 })
    expect(thirty.get('n30_29')!.readMedian!.band).toBe('top10')
    expect(thirty.get('n30_0')!.readMedian!.band).toBe('bottom')
  })

  it('low-is-better ranks mirror high-is-better exactly', () => {
    const members = Array.from({ length: 40 }, (_, i) => member(`m${i}`, 20_000, { readMedian: i, cpe: 40 - i }))
    const ranked = rankGroup(members, { target: 97 })
    for (const m of members) expect(ranked.get(m.id)!.cpe!.percentile).toBe(ranked.get(m.id)!.readMedian!.percentile)
  })

  it('爆文率 ranks on the Wilson lower bound; fewer than 5 notes are not ranked', () => {
    expect(wilsonLowerBound(1, 2)).toBeLessThan(wilsonLowerBound(20, 100))
    expect(rankValue('viralRate', { ...emptyMetrics(), viralCount: 1, noteCount: 4, viralRate: 0.25 })).toBeNull()
    expect(rankValue('viralRate', { ...emptyMetrics(), viralCount: 2, noteCount: 5 })).toBeCloseTo(wilsonLowerBound(2, 5), 12)
    expect(rankValue('viralRate', { ...emptyMetrics(), viralRate: 0.2, noteCount: 50 })).toBeCloseTo(wilsonLowerBound(10, 50), 12)
    const members = [
      member('lucky', 10_000, { viralCount: 1, noteCount: 5 }),
      member('steady', 10_000, { viralCount: 15, noteCount: 60 }),
      ...Array.from({ length: 30 }, (_, i) => member(`o${i}`, 10_000, { viralCount: 1, noteCount: 30 })),
    ]
    const ranked = rankGroup(members, { target: 97 })
    expect(ranked.get('steady')!.viralRate!.percentile).toBeGreaterThan(ranked.get('lucky')!.viralRate!.percentile)
  })

  it('the platform rank wins when given; ours stays next to it as 本库', () => {
    const members = Array.from({ length: 12 }, (_, i) => member(`p${i}`, 10_000, { readMedian: 100 + i }))
    members[0].metrics.platformRanks = { readMedian: 0.873 }
    const entry = rankGroup(members, { target: 97 }).get('p0')!.readMedian!
    expect(entry).toMatchObject({ percentile: 87.3, band: 'top25', scope: 'platform' })
    expect(entry.library).toMatchObject({ percentile: 4.2, band: 'back', n: 12 })
  })

  it('stale snapshots are neither compared nor ranked', () => {
    const now = new Date('2026-09-24T00:00:00Z')
    expect(isStale('2026-07-25T00:00:00Z', now)).toBe(true)
    expect(isStale('2026-07-27T00:00:00Z', now)).toBe(false)
    expect(isStale(null, now)).toBe(false)
    const members = Array.from({ length: 12 }, (_, i) => member(`t${i}`, 10_000, { readMedian: 100 + i }, i < 2))
    const ranked = rankGroup(members, { target: 97 })
    expect(ranked.get('t0')).toBeUndefined()
    expect(ranked.get('t11')!.readMedian!.n).toBe(10)
  })

  it('unknown follower counts are compared only with each other', () => {
    const members = [
      ...Array.from({ length: 10 }, (_, i) => member(`u${i}`, null, { readMedian: i })),
      ...Array.from({ length: 10 }, (_, i) => member(`k${i}`, 5_000, { readMedian: 1_000 + i })),
    ]
    const ranked = rankGroup(members, { target: 97 })
    expect(ranked.get('u9')!.readMedian).toMatchObject({ n: 10, percentile: 95 })
    expect(ranked.get('u9')!.readMedian!.followersMin).toBeUndefined()
  })

  it('reference lines: 25 / 50 / 75 per tier, only with 30 or more current values', () => {
    const members = [
      ...Array.from({ length: 30 }, (_, i) => member(`r${i}`, 60_000, { cpe: i + 1 })),
      ...Array.from({ length: 29 }, (_, i) => member(`j${i}`, 6_000, { cpe: i + 1 })),
    ]
    expect(referenceLines(members, ['cpe'])).toEqual([{ tier: 'mid', key: 'cpe', n: 30, p25: 8.25, p50: 15.5, p75: 22.75 }])
  })

  it('calibration: seeded bootstrap, at least 30, the normal approximation without data', () => {
    const random = lcg(5)
    const members = Array.from({ length: 300 }, (_, i) =>
      member(`b${i}`, 10_000 + i, { readMedian: Math.round(random() * 10_000), interactionMedian: Math.round(random() * 500) }))
    const first = calibrateSample(members)
    expect(first).toEqual(calibrateSample(members))
    expect(first.method).toBe('bootstrap')
    expect(first.target).toBeGreaterThanOrEqual(30)
    expect(first.required).toBeGreaterThanOrEqual(60)
    expect(first.required).toBeLessThanOrEqual(150)
    const need = first.metrics.readMedian!
    expect(need.halfWidths[need.required!]).toBeLessThanOrEqual(10)
    const few = calibrateSample(members.slice(0, 20))
    expect(few).toMatchObject({ method: 'analytic', required: null, target: COHORT_RULES.analyticSample })
  })
})
