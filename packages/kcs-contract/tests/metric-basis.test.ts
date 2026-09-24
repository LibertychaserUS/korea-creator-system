import { describe, expect, it } from 'vitest'
import { BASIS_BACKTEST_RULES, basisBacktest, stratifiedAuc, type BacktestRow } from '../src/basis-backtest'
import { rankAgainst, rankGroup, referenceLines, type CohortMember } from '../src/cohort'
import { basisFamily, costFellBack, metricBasisOf, PREFERRED_BASIS } from '../src/metric-basis'
import { emptyMetrics, type CreatorMetrics } from '../src/metrics'
import { expectedRefreshCalls, refreshCoverage, schedulerDailyCalls } from '../src/refresh-coverage'
import { REACH_BUSINESS_SCOPE, SOURCE_SCOPE_DEFAULTS } from '../src/source-adapter'

type Scope = { traffic: 'organic' | 'all'; business: 'coop' | 'daily' }

function member(id: string, followers: number, scope: Scope | null, m: Partial<CreatorMetrics>): CohortMember {
  const metrics = { ...emptyMetrics(30), followers, ...m }
  if (scope) metrics.basis = { ...metrics.basis, trafficScope: scope.traffic, businessScope: scope.business }
  return { id, followers, metrics, stale: false }
}

function lcg(seed: number) {
  let s = seed
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2 ** 31
    return s / 2 ** 31
  }
}

describe('default 口径', () => {
  it('蒲公英 ranks cost on 合作笔记 and reach on 自然流量; reach is always read on 日常笔记', () => {
    expect(SOURCE_SCOPE_DEFAULTS.pugongying).toEqual({ traffic: 'organic', business: 'coop' })
    expect(PREFERRED_BASIS).toEqual({ cost: 'coop', reach: 'organic' })
    expect(REACH_BUSINESS_SCOPE).toBe('daily')
  })

  it('reads the 口径 of one value from the record, and a record without one as the platform default', () => {
    const organicCoop = member('a', 10_000, { traffic: 'organic', business: 'coop' }, {}).metrics
    expect(basisFamily('cpe')).toBe('cost')
    expect(basisFamily('readMedian')).toBe('reach')
    expect(basisFamily('followers')).toBeNull()
    expect(metricBasisOf('cpe', organicCoop)).toBe('coop')
    expect(metricBasisOf('readMedian', organicCoop)).toBe('organic')
    expect(metricBasisOf('followers', organicCoop)).toBeNull()

    const legacy = emptyMetrics(30)
    expect(metricBasisOf('cpe', legacy)).toBe('daily')
    expect(metricBasisOf('engagementRate', legacy)).toBe('all')

    // A derived cost is 合作 only when it was divided by a 合作 median.
    const derivedCoop = { ...organicCoop, derived: ['cpe' as const], basis: { ...organicCoop.basis, cpe: 'priceImage/coopInteractionMedian' } }
    expect(metricBasisOf('cpe', derivedCoop)).toBe('coop')
    const derivedDaily = { ...organicCoop, derived: ['cpe' as const], basis: { ...organicCoop.basis, cpe: 'priceImage/interactionMedian' } }
    expect(metricBasisOf('cpe', derivedDaily)).toBe('daily')
  })

  it('a 合作 → 日常 fallback is recorded on the basis and read back', () => {
    const fellBack = member('a', 10_000, { traffic: 'organic', business: 'daily' }, {}).metrics
    expect(costFellBack(fellBack)).toBe(false)
    fellBack.basis.costFallback = 'noCoopData'
    expect(costFellBack(fellBack)).toBe(true)
    expect(metricBasisOf('cpe', fellBack)).toBe('daily')
  })
})

describe('ranking never mixes 口径', () => {
  const coop = { traffic: 'organic', business: 'coop' } as const
  const daily = { traffic: 'organic', business: 'daily' } as const
  const allTraffic = { traffic: 'all', business: 'coop' } as const

  it('a creator on 日常 cost is ranked among 日常 values only, and the same for reach', () => {
    // 20 合作 creators with CPE 10..29, 20 日常 creators with CPE 1..20 (cheaper: 日常 notes are cheaper).
    const members = [
      ...Array.from({ length: 20 }, (_, i) => member(`c${i}`, 10_000 + i, coop, { cpe: 10 + i, readMedian: 1_000 + i })),
      ...Array.from({ length: 20 }, (_, i) => member(`d${i}`, 10_000 + i, daily, { cpe: 1 + i, readMedian: 1_000 + i })),
      ...Array.from({ length: 12 }, (_, i) => member(`a${i}`, 10_000 + i, allTraffic, { cpe: 10 + i, readMedian: 50_000 + i })),
    ]
    const keys = ['cpe', 'readMedian'] as const
    const ranked = rankGroup(members, { target: 10, keys })
    const only = (prefix: string[]) => rankGroup(members.filter((m) => prefix.includes(m.id[0]!)), { target: 10, keys })
    // A 日常 cost ranks as if the 合作 creators were not there, and the other way round.
    expect(ranked.get('d19')!.cpe).toEqual(only(['d']).get('d19')!.cpe)
    expect(ranked.get('c19')!.cpe).toEqual(only(['c', 'a']).get('c19')!.cpe)
    // 全部流量 reach (50k) does not push 自然流量 creators down.
    expect(ranked.get('c19')!.readMedian).toEqual(only(['c', 'd']).get('c19')!.readMedian)
    expect(ranked.get('a11')!.readMedian).toEqual(only(['a']).get('a11')!.readMedian)
    expect(ranked.get('c19')!.readMedian!.percentile).toBeGreaterThanOrEqual(90)
    // Cohort sizes are counted within one 口径.
    expect(ranked.get('d0')!.cpe!.n).toBeLessThanOrEqual(20)
    expect(ranked.get('c0')!.cpe!.n).toBeLessThanOrEqual(32)
  })

  it('rankGroup and rankAgainst agree on mixed 口径 pools', () => {
    const random = lcg(7)
    const pick = <T,>(values: readonly T[]) => values[Math.floor(random() * values.length)]!
    const scopes = [coop, daily, allTraffic, null]
    const members = Array.from({ length: 300 }, (_, i) =>
      member(`m${String(i).padStart(3, '0')}`, pick([3_000, 8_000, 12_000, 40_000, 90_000]), pick(scopes), {
        cpe: pick([null, 1.5, 2.5, 3, 9]),
        readMedian: pick([null, 800, 1_200, 5_000]),
        noteCount: pick([null, 3, 10]),
      }))
    const keys = ['cpe', 'readMedian', 'noteCount'] as const
    const ranked = rankGroup(members, { target: 10, keys })
    for (const m of members) expect(ranked.get(m.id) ?? {}, m.id).toEqual(rankAgainst(members, m, { target: 10, keys }))
  })

  it('a reference line is drawn from one 口径: the one with most values, ties going to the default', () => {
    const members = [
      ...Array.from({ length: 30 }, (_, i) => member(`c${i}`, 10_000 + i, coop, { cpe: 100 })),
      ...Array.from({ length: 40 }, (_, i) => member(`d${i}`, 10_000 + i, daily, { cpe: 1 })),
    ]
    expect(referenceLines(members, ['cpe'])).toMatchObject([{ key: 'cpe', n: 40, p50: 1 }])
    const tied = [...members.slice(0, 30), ...members.slice(30, 60)]
    expect(referenceLines(tied, ['cpe'])).toMatchObject([{ key: 'cpe', n: 30, p50: 100 }])
  })
})

describe('what the budget buys (scheduler coverage)', () => {
  it('slow sections are counted in the calls one refresh costs, spread over their cycle', () => {
    // 3 base calls; fan sections (2) every 30 days; the 含投放 reference (1) every 30 days; at a 7-day interval.
    expect(expectedRefreshCalls(3, [{ calls: 2, everyDays: 30 }, { calls: 1, everyDays: 30 }], 7)).toBeCloseTo(3 + 3 * 7 / 30, 10)
    // Switched off (null) costs nothing; a cycle shorter than the interval costs every time.
    expect(expectedRefreshCalls(3, [{ calls: 1, everyDays: null }, { calls: 2, everyDays: 0 }], 7)).toBe(5)
    expect(expectedRefreshCalls(3, [{ calls: 2, everyDays: 5 }], 7)).toBe(5)
  })

  it('the tighter of call quota and money budget wins', () => {
    expect(schedulerDailyCalls({ quota: 1000, budgetShare: 0.8, budgetUsd: 5, pricePerCallUsd: 0.02 })).toEqual({ calls: 200, limitedBy: 'money' })
    expect(schedulerDailyCalls({ quota: 100, budgetShare: 0.8, budgetUsd: 5, pricePerCallUsd: 0.02 })).toEqual({ calls: 80, limitedBy: 'quota' })
    expect(schedulerDailyCalls({ quota: 1000, budgetShare: 0.8, budgetUsd: null, pricePerCallUsd: 0.02 })).toEqual({ calls: 800, limitedBy: 'quota' })
  })

  it('says how many creators the budget keeps current and how often', () => {
    const callsPerRefresh = expectedRefreshCalls(3, [{ calls: 2, everyDays: 30 }, { calls: 1, everyDays: 30 }], 7)
    const tight = refreshCoverage({
      source: 'pugongying', quota: 1000, budgetShare: 0.8, budgetUsd: 5, pricePerCallUsd: 0.02,
      refreshShare: 0.7, callsPerRefresh, knownCreators: 1000, modelIntervalDays: 7,
    })
    expect(tight).toMatchObject({ limitedBy: 'money', dailyCalls: 200, knownCreators: 1000, coveredCreators: 1000, enough: false })
    expect(tight.refreshCallsPerDay).toBeCloseTo(140, 10)
    expect(tight.refreshesPerDay).toBeCloseTo(140 / callsPerRefresh, 10)
    expect(tight.intervalDays).toBeCloseTo(1000 / (140 / callsPerRefresh), 10)
    expect(tight.usdPerDayForAll).toBeCloseTo((1000 / 7) * callsPerRefresh * 0.02, 10)

    const ample = refreshCoverage({ ...tight, quota: 1000, budgetShare: 0.8, budgetUsd: 100, knownCreators: 50 })
    expect(ample).toMatchObject({ enough: true, intervalDays: 7, coveredCreators: 50 })

    const nobody = refreshCoverage({ ...tight, quota: 1000, budgetShare: 0.8, knownCreators: 0 })
    expect(nobody.intervalDays).toBeNull()
  })

  it('the 含投放 reference costs money: switching it on lowers the refreshes a fixed budget buys', () => {
    const base = { source: 'pugongying', quota: 1000, budgetShare: 0.8, budgetUsd: 5, pricePerCallUsd: 0.02, refreshShare: 0.7, knownCreators: 2000, modelIntervalDays: 7 }
    const without = refreshCoverage({ ...base, callsPerRefresh: expectedRefreshCalls(3, [{ calls: 2, everyDays: 30 }, { calls: 1, everyDays: null }], 7) })
    const withRef = refreshCoverage({ ...base, callsPerRefresh: expectedRefreshCalls(3, [{ calls: 2, everyDays: 30 }, { calls: 1, everyDays: 30 }], 7) })
    expect(withRef.refreshesPerDay).toBeLessThan(without.refreshesPerDay)
    expect(withRef.intervalDays!).toBeGreaterThan(without.intervalDays!)
    expect(withRef.usdPerDayForAll!).toBeGreaterThan(without.usdPerDayForAll!)
  })
})

describe('offline backtest of the 口径', () => {
  function rows(n: number, positives: number, signal: (used: boolean, random: () => number) => { organic: number; all: number }): BacktestRow[] {
    const random = lcg(3)
    return Array.from({ length: n }, (_, i) => {
      const used = i < positives
      const reach = signal(used, random)
      return {
        creatorId: `c${i}`,
        followers: [3_000, 20_000, 80_000][i % 3]!,
        used,
        values: { readMedian: { organic: reach.organic, all: reach.all }, cpe: { coop: 1 + random(), daily: 1 + random() } },
      }
    })
  }

  it('with too few labelled creators it says 样本不足 and gives no numbers', () => {
    const report = basisBacktest(rows(120, 40, () => ({ organic: 1, all: 1 })))
    expect(report.status).toBe('insufficient')
    expect(report.records).toBe(120)
    for (const comparison of report.comparisons) {
      expect(comparison.verdict).toBe('insufficient')
      expect(comparison.better).toBeNull()
      expect(comparison.scores.every((s) => s.auc == null && s.se == null && s.spearman == null)).toBe(true)
    }
    // Enough creators but too few were used: still nothing.
    expect(basisBacktest(rows(400, 10, () => ({ organic: 1, all: 1 }))).status).toBe('insufficient')
    // Enough overall, but no one has a value on both 口径 of a metric: that comparison stays silent.
    const report2 = basisBacktest(rows(400, 80, (used, r) => ({ organic: (used ? 2 : 1) + r(), all: r() })))
    const engagement = report2.comparisons.find((c) => c.key === 'engagementRate')!
    expect(engagement).toMatchObject({ paired: 0, verdict: 'insufficient' })
  })

  it('prefers the 口径 that clearly tells used creators apart, and says no difference when neither does', () => {
    const clear = basisBacktest(rows(600, 150, (used, r) => ({ organic: (used ? 1.6 : 1) + r(), all: r() * 2 })))
    expect(clear.status).toBe('ok')
    const read = clear.comparisons.find((c) => c.key === 'readMedian')!
    expect(read).toMatchObject({ family: 'reach', current: 'organic', paired: 600, positives: 150, verdict: 'prefer', better: 'organic' })
    expect(read.scores[0]!.auc!).toBeGreaterThan(0.7)
    expect(read.scores[1]!.auc!).toBeGreaterThan(0.35)
    expect(read.scores[1]!.auc!).toBeLessThan(0.65)
    // cpe is noise on both 口径.
    expect(clear.comparisons.find((c) => c.key === 'cpe')!.verdict).toBe('no_difference')
  })

  it('low-is-better metrics are turned around before the AUC; ties share a rank', () => {
    const cheapUsed = stratifiedAuc([
      { tier: 'mid', score: -1, used: true },
      { tier: 'mid', score: -2, used: false },
      { tier: 'mid', score: -2, used: false },
    ])
    expect(cheapUsed.auc).toBe(1)
    expect(stratifiedAuc([{ tier: 'mid', score: 1, used: true }, { tier: 'mid', score: 1, used: false }]).auc).toBe(0.5)
    expect(stratifiedAuc([{ tier: 'mid', score: 1, used: true }]).auc).toBeNull()
    expect(BASIS_BACKTEST_RULES.minRecords).toBeGreaterThanOrEqual(BASIS_BACKTEST_RULES.minPaired)
  })
})
