import { describe, expect, it } from 'vitest'
import { METRIC_KEYS, cohortPercentiles, deriveMetrics, emptyMetrics } from '../src/metrics'
import { applySavedQuery, defaultSavedQuery, type QueryRow } from '../src/saved-query'
import { toNumber, toRatio } from '../src/source-adapter'

/**
 * INV-01 (invariants.yaml `INV-metrics-null-not-zero`): a number the platform
 * did not give us stays `null` all the way through — never a default, never 0,
 * never a guess (docs/03 §缺失值, docs/04 §转换).
 */

function row(id: string, m: Partial<ReturnType<typeof emptyMetrics>>): QueryRow {
  return {
    id,
    creatorKey: `xhs:${id}`,
    displayName: id,
    source: 'qiangua',
    regions: [],
    coopBrands: [],
    metrics: deriveMetrics({ ...emptyMetrics(30), ...m }),
  }
}

describe('INV-01 平台取不到的指标保持 null、不补 0', () => {
  it('functional: an empty record is all null, and deriving only fills ratios whose inputs exist', () => {
    const empty = emptyMetrics(30)
    for (const key of METRIC_KEYS) expect(empty[key], key).toBeNull()
    expect(empty.health).toBeNull()

    const m = deriveMetrics({ ...emptyMetrics(30), followers: 50_000, priceImage: 2_000 })
    expect(m.followers).toBe(50_000)
    for (const key of ['readMedian', 'interactionMedian', 'engagementRate', 'cpe', 'cpv', 'cpm', 'readToFollowerRatio', 'viralRate', 'collectLikeRatio', 'followerGrowthRate'] as const) {
      expect(m[key], key).toBeNull()
    }
  })

  it('negative: blank / dash / unparsable vendor cells and zero denominators become null, not 0', () => {
    for (const cell of [null, undefined, '', '-', '--', 'N/A', '暂无']) {
      expect(toNumber(cell), String(cell)).toBeNull()
      expect(toRatio(cell), String(cell)).toBeNull()
    }
    expect(toNumber(Number.NaN)).toBeNull()
    const m = deriveMetrics({ ...emptyMetrics(30), followers: 0, readMedian: 1_000, noteCount: 0, viralCount: 0 })
    expect(m.readToFollowerRatio).toBeNull()
    expect(m.viralRate).toBeNull()
  })

  it('edge: a real 0 from the platform stays 0, and nulls are not ranked or filtered as if they were 0', () => {
    const m = deriveMetrics({ ...emptyMetrics(30), viralCount: 0, noteCount: 12 })
    expect(m.viralCount).toBe(0)
    expect(m.viralRate).toBe(0)

    const known = { ...emptyMetrics(), cpe: 2 }
    const worse = { ...emptyMetrics(), cpe: 8 }
    const missing = emptyMetrics()
    expect(cohortPercentiles(missing, [known, worse, missing], ['cpe'])).toEqual({})
    expect(cohortPercentiles(known, [known, missing], ['cpe'])).toEqual({})

    const rows = [
      row('priced', { followers: 20_000, readMedian: 4_000, interactionMedian: 400, priceImage: 800 }),
      row('unpriced', { followers: 20_000, readMedian: 4_000, interactionMedian: 400 }),
    ]
    const cheap = applySavedQuery(rows, defaultSavedQuery({ name: 'cheap', health: [], filters: [{ key: 'cpe', op: 'lte', value: 5 }] }))
    expect(cheap.map((r) => r.id)).toEqual(['priced'])
    const sorted = applySavedQuery(rows, defaultSavedQuery({ name: 'all', health: [], sort: { key: 'cpe', dir: 'asc' } }))
    expect(sorted.map((r) => r.id)).toEqual(['priced', 'unpriced'])
    expect(sorted[1]!.metrics.cpe).toBeNull()
  })
})
