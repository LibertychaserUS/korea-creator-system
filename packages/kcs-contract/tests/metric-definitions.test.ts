import { describe, expect, it } from 'vitest'
import {
  COST_METRIC_KEYS,
  VISIBLE_METRIC_KEYS,
  deriveMetrics,
  directedPercentileTenths,
  emptyMetrics,
  metricField,
  normalizeHealth,
  normalizeMetrics,
  withServiceFee,
} from '../src/metrics'
import { fromMinorUnits, normalizeCurrency, priceInCny, toMinorUnits } from '../src/money'
import { defaultSavedQuery, normalizeSavedQuery, validateSavedQuery } from '../src/saved-query'

describe('metric definitions (口径)', () => {
  it('CPM is per 1000 exposures only; the per-read figure is cpmRead', () => {
    const m = deriveMetrics({ ...emptyMetrics(30), priceImage: 3_000, readMedian: 7_000, impressionMedian: 90_000 })
    expect(m.cpm).toBeCloseTo(3_000 * 1000 / 90_000, 12)
    expect(m.cpmRead).toBeCloseTo(3_000 * 1000 / 7_000, 12)
    expect(m.basis.cpm).toBe('priceImage*1000/impressionMedian')
    expect(deriveMetrics({ ...emptyMetrics(30), priceImage: 3_000, readMedian: 7_000 }).cpm).toBeNull()
  })

  it('derived values keep full precision and say how they were computed', () => {
    const m = deriveMetrics({ ...emptyMetrics(30), readMedian: 3_000, interactionMedian: 100, priceImage: 1_000 })
    expect(m.engagementRate).toBe(100 / 3_000)
    expect(m.cpe).toBe(10)
    expect(m.cpr).toBe(1_000 / 3_000)
    expect(m.derived).toEqual(expect.arrayContaining(['engagementRate', 'cpe', 'cpr']))
    expect(m.basis.cpe).toBe('priceImage/interactionMedian')
    expect(deriveMetrics(m)).toEqual(m)
  })

  it('a platform value is never replaced by a derived one', () => {
    const m = deriveMetrics({ ...emptyMetrics(30), readMedian: 3_000, interactionMedian: 100, priceImage: 1_000, cpe: 7.5 })
    expect(m.cpe).toBe(7.5)
    expect(m.derived).not.toContain('cpe')
    expect(m.basis.cpe).toBeUndefined()
  })

  it('image and video CPE stay apart; a video price never stands in for the image price', () => {
    const m = deriveMetrics({ ...emptyMetrics(30), interactionMedian: 200, priceVideo: 8_000 })
    expect(m.cpe).toBeNull()
    expect(m.cpeVideo).toBe(40)
    expect(m.basis.cpeVideo).toBe('priceVideo/interactionMedian')
  })

  it('follower growth rate is empty when the starting count is not positive', () => {
    expect(deriveMetrics({ ...emptyMetrics(30), followers: 1_000, followerGrowth: 1_000 }).followerGrowthRate).toBeNull()
    expect(deriveMetrics({ ...emptyMetrics(30), followers: 500, followerGrowth: 900 }).followerGrowthRate).toBeNull()
    expect(deriveMetrics({ ...emptyMetrics(30), followers: 1_100, followerGrowth: 100 }).followerGrowthRate).toBe(0.1)
  })

  it('old stored records: old rounded derivations go back to full precision; renamed keys are not read', () => {
    const legacy = {
      window: 30,
      readMedian: 3_000,
      interactionMedian: 100,
      priceImage: 1_000,
      engagementRate: 0.0333,
      cpe: 10,
      cpm: 333.33,
      retentionRate: 0.41,
      health: 'excellent',
    }
    const m = normalizeMetrics(legacy, 'qiangua')
    expect(m.engagementRate).toBe(100 / 3_000)
    expect(m.cpr).toBe(1_000 / 3_000)
    // Migrations 0021 / 0026 moved stored `retentionRate`; a stray one is dropped, not guessed.
    expect(m.completionRate).toBeNull()
    expect(m.cpm).toBeNull()
    expect(m.cpmRead).toBeCloseTo(1_000_000 / 3_000, 9)
    expect(m.health).toBe('healthy')
    expect((m as any).retentionRate).toBeUndefined()
  })

  it('a CPM a platform reported keeps its value but moves to cpmRead unless it is 蒲公英', () => {
    expect(normalizeMetrics({ cpm: 120 }, 'xinhong').cpmRead).toBe(120)
    expect(normalizeMetrics({ cpm: 120 }, 'xinhong').cpm).toBeNull()
    expect(normalizeMetrics({ cpm: 120 }, 'pugongying').cpm).toBe(120)
  })

  it('non-finite numbers never reach storage', () => {
    const m = normalizeMetrics({ readMedian: Number.POSITIVE_INFINITY, cpe: Number.NaN, followers: 1e400 }, 'qiangua')
    expect(m.readMedian).toBeNull()
    expect(m.cpe).toBeNull()
    expect(m.followers).toBeNull()
  })

  it('health is two grades; 蒲公英 old values were really the low-activity flag', () => {
    expect(normalizeHealth('excellent', undefined, 'pugongying')).toEqual({ health: null, lowActive: false })
    expect(normalizeHealth('abnormal', undefined, 'pugongying')).toEqual({ health: null, lowActive: true })
    expect(normalizeHealth('normal', undefined, 'qiangua').health).toBe('healthy')
    expect(normalizeHealth('abnormal', undefined, 'qiangua').health).toBe('abnormal')
    expect(normalizeHealth('healthy', true, 'pugongying')).toEqual({ health: 'healthy', lowActive: true })
  })

  it('metrics whose direction is not "more is better" are description only', () => {
    for (const key of ['readFanRatio', 'trafficSearchRatio', 'trafficRecommendRatio', 'noteCount'] as const) {
      expect(metricField(key).better, key).toBeNull()
    }
    expect(VISIBLE_METRIC_KEYS).not.toContain('purchaseIntentCommentRatio')
  })

  it('service fee scales every cost metric and nothing else', () => {
    const m = deriveMetrics({ ...emptyMetrics(30), readMedian: 1_000, interactionMedian: 100, priceImage: 1_000 })
    const fee = withServiceFee(m, 0.2)
    for (const key of COST_METRIC_KEYS) {
      if (m[key] != null) expect(fee[key], key).toBeCloseTo(m[key]! * 1.2, 9)
    }
    expect(fee.engagementRate).toBe(m.engagementRate)
    expect(withServiceFee(m, 0)).toEqual(m)
  })

  it('low-is-better rounding mirrors high-is-better (数值第 20 条)', () => {
    expect(directedPercentileTenths('cpe', 100, 1, 1_000)).toBe(900)
    expect(directedPercentileTenths('readMedian', 899, 1, 1_000)).toBe(900)
    for (let below = 0; below < 10; below += 1) {
      for (let equal = 1; below + equal <= 10; equal += 1) {
        const mirror = 10 - below - equal
        expect(directedPercentileTenths('cpe', below, equal, 10)).toBe(directedPercentileTenths('readMedian', mirror, equal, 10))
      }
    }
  })
})

describe('money', () => {
  it('stores amounts in the smallest unit of an upper-case currency', () => {
    expect(normalizeCurrency(' krw ')).toBe('KRW')
    expect(normalizeCurrency('JPY')).toBeNull()
    expect(toMinorUnits(3_000.5, 'CNY')).toBe(300_050)
    expect(toMinorUnits(1_000_000, 'KRW')).toBe(1_000_000)
    expect(fromMinorUnits('300050', 'CNY')).toBe(3_000.5)
    expect(toMinorUnits(null, 'CNY')).toBeNull()
  })

  it('a foreign amount becomes 人民币 only with a recorded rate; unknown is null, never 0', () => {
    expect(priceInCny(3_000, 'CNY')).toBe(3_000)
    expect(priceInCny(1_000_000, 'KRW')).toBeNull()
    expect(priceInCny(1_000_000, 'KRW', 0.0052)).toBeCloseTo(5_200, 6)
    expect(priceInCny(null, 'CNY')).toBeNull()
    expect(priceInCny(10, 'JPY', 0.05)).toBeNull()
  })
})

describe('saved queries in the new vocabulary', () => {
  it('old health values are read into the two grades; metric keys are taken as stored', () => {
    const old = {
      ...defaultSavedQuery({ name: 'old' }),
      columns: ['followers', 'cpr', 'completionRate', 'cpr'],
      filters: [{ key: 'cpr', op: 'lte', value: 0.5 }],
      sort: { key: 'cpr', dir: 'asc' },
      health: ['excellent', 'normal'],
    }
    const q = normalizeSavedQuery(old)
    expect(q.columns).toEqual(['followers', 'cpr', 'completionRate'])
    expect(q.health).toEqual(['healthy'])
    expect(q.serviceFee).toBe(0)
    expect(validateSavedQuery(q)).toEqual([])
    expect(validateSavedQuery({ ...q, serviceFee: 0.15 as any }).length).toBeGreaterThan(0)
    expect(validateSavedQuery({ ...q, columns: ['cpv'] as any }).length).toBeGreaterThan(0)
  })
})
