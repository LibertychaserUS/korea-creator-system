import { describe, expect, it } from 'vitest'
import {
  METRIC_FIELDS,
  bandOf,
  cohortPercentiles,
  deriveMetrics,
  emptyMetrics,
  tierOf,
} from '../src/metrics'
import { toHealth, toNumber, toRatio } from '../src/source-adapter'
import { applySavedQuery, defaultSavedQuery, validateSavedQuery, type QueryRow } from '../src/saved-query'

function row(id: string, m: Partial<ReturnType<typeof emptyMetrics>>): QueryRow {
  return {
    id,
    creatorKey: `xhs:${id}`,
    displayName: id,
    source: 'pugongying',
    regions: ['上海'],
    coopBrands: [],
    metrics: { ...emptyMetrics(30), ...m },
  }
}

describe('CreatorMetrics', () => {
  it('follower tiers follow the 千瓜 cut-offs', () => {
    expect(tierOf(600_000)).toBe('head')
    expect(tierOf(50_000)).toBe('mid')
    expect(tierOf(5_000)).toBe('junior')
    expect(tierOf(300)).toBe('amateur')
    expect(tierOf(null)).toBe('unknown')
  })

  it('derives only plain ratios and never overwrites platform values', () => {
    const m = deriveMetrics({
      ...emptyMetrics(30),
      followers: 100_000,
      readMedian: 20_000,
      interactionMedian: 800,
      likeMedian: 500,
      collectMedian: 450,
      priceImage: 3_000,
      viralCount: 2,
      noteCount: 10,
      followerGrowth: 5_000,
      cpe: 1.23,
    })
    expect(m.engagementRate).toBe(0.04)
    expect(m.cpr).toBe(0.15)
    expect(m.cpm).toBeNull()
    expect(m.cpe).toBe(1.23)
    expect(m.collectLikeRatio).toBe(0.9)
    expect(m.readToFollowerRatio).toBe(0.2)
    expect(m.viralRate).toBe(0.2)
    expect(m.followerGrowthRate).toBeCloseTo(0.0526, 4)
    expect(deriveMetrics(emptyMetrics()).cpe).toBeNull()
  })

  it('every field has a catalog entry with a group and a direction', () => {
    const keys = new Set(METRIC_FIELDS.map((f) => f.key))
    expect(keys.size).toBe(METRIC_FIELDS.length)
    expect(METRIC_FIELDS.find((f) => f.key === 'cpe')?.better).toBe('low')
    expect(METRIC_FIELDS.find((f) => f.key === 'followers')?.better).toBeNull()
  })

  it('percentiles are computed inside the cohort and inverted for lower-is-better', () => {
    const a = { ...emptyMetrics(), cpe: 1 }
    const b = { ...emptyMetrics(), cpe: 5 }
    const c = { ...emptyMetrics(), cpe: 10 }
    const p = cohortPercentiles(a, [a, b, c], ['cpe'])
    expect(p.cpe!.percentile).toBeGreaterThan(80)
    expect(p.cpe!.band).toBe('front')
    expect(p.cpe!.n).toBe(3)
    expect(bandOf(95)).toBe('top10')
    expect(bandOf(95, 12)).toBe('front')
    expect(bandOf(50, 12)).toBe('middle')
    expect(bandOf(10, 12)).toBe('back')
    expect(bandOf(10)).toBe('bottom')
    expect(cohortPercentiles(a, [a], ['cpe'])).toEqual({})
  })
})

describe('transform helpers', () => {
  it('parses Chinese counts, percents and health grades', () => {
    expect(toNumber('18.6w')).toBe(186_000)
    expect(toNumber('1,234')).toBe(1234)
    expect(toNumber('3.2万')).toBe(32_000)
    expect(toRatio('3.2%')).toBeCloseTo(0.032)
    expect(toRatio(3.2, true)).toBeCloseTo(0.032)
    expect(toRatio(0.032)).toBe(0.032)
    expect(toHealth('优秀')).toBe('healthy')
    expect(toHealth('异常')).toBe('abnormal')
    expect(toHealth('x')).toBeNull()
  })
})

describe('SavedQuery replaces scoring', () => {
  const rows = [
    row('a', { followers: 120_000, readMedian: 30_000, interactionMedian: 1_500, priceImage: 3_000, health: 'healthy', likeMedian: 900, collectMedian: 900 }),
    row('b', { followers: 90_000, readMedian: 5_000, interactionMedian: 100, priceImage: 6_000, health: 'healthy', likeMedian: 80, collectMedian: 10 }),
    row('c', { followers: 150_000, readMedian: 40_000, interactionMedian: 3_000, priceImage: 2_000, health: 'abnormal', likeMedian: 2_000, collectMedian: 1_000 }),
    row('d', { followers: 8_000, readMedian: 9_000, interactionMedian: 700, priceImage: 500, health: 'healthy' }),
  ]

  it('drops unhealthy accounts, applies metric filters, sorts by CPE ascending', () => {
    const q = defaultSavedQuery({
      name: 'q',
      health: ['healthy'],
      filters: [{ key: 'cpe', op: 'lte', value: 5 }],
      highlights: [
        { key: 'cpe', op: 'lte', value: 3, tone: 'good' },
        { key: 'collectLikeRatio', op: 'gte', value: 0.8, tone: 'good' },
      ],
    })
    const res = applySavedQuery(rows, q)
    expect(res.map((r) => r.id)).toEqual(['d', 'a'])
    expect(res[0]!.tier).toBe('junior')
    expect(res[1]!.flags.map((f) => f.key)).toEqual(expect.arrayContaining(['cpe', 'collectLikeRatio']))
  })

  it('percentile filters rank against the whole group, not the filtered subset', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      row(`m${i}`, { followers: 60_000 + i * 1_000, readMedian: 10_000, interactionMedian: 100 + i * 10, health: i % 2 ? 'healthy' : 'abnormal' }))
    const q = defaultSavedQuery({
      name: 'q',
      health: ['healthy'],
      filters: [{ key: 'engagementRate', op: 'percentileGte', value: 50 }],
    })
    const res = applySavedQuery(many, q)
    expect(res.every((r) => r.metrics.health === 'healthy' && r.percentiles.engagementRate!.percentile >= 50)).toBe(true)
    expect(res.map((r) => r.id).sort()).toEqual(many.filter((_, i) => i % 2 && i >= 20).map((r) => r.id).sort())
    expect(res[0]!.percentiles.engagementRate!.n).toBe(40)
    expect(applySavedQuery(rows, q).every((r) => !r.percentiles.engagementRate)).toBe(true)
  })

  it('validates name, keys and between ranges', () => {
    expect(validateSavedQuery(defaultSavedQuery({ name: 'ok' }))).toEqual([])
    expect(validateSavedQuery(defaultSavedQuery({ name: '' }))).toContain('name.required')
    expect(
      validateSavedQuery(defaultSavedQuery({ name: 'x', filters: [{ key: 'cpe', op: 'between', value: [5, 1] }] })),
    ).toContain('filters.between')
    expect(validateSavedQuery(null)).toEqual(['query.invalid'])
  })
})
