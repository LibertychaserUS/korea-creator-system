import { describe, expect, it } from 'vitest'
import {
  applySavedQuery,
  defaultHighlights,
  defaultSavedQuery,
  emptyMetrics,
  highlightFlags,
  normalizeSavedQuery,
  validateSavedQuery,
  type CreatorMetrics,
  type MetricPercentiles,
  type QueryRow,
} from '../src'

const rank = (percentile: number) => ({ percentile, band: 'middle' as const, n: 12 })

function row(source: string | null, metrics: Partial<CreatorMetrics>, percentiles: MetricPercentiles) {
  return { source, metrics: { ...emptyMetrics(30), ...metrics }, percentiles }
}

/** Break: a default highlight reads an absolute number, fires without a percentile, or a red health row still shows "good". */
describe('highlights', () => {
  const defaults = defaultHighlights()

  it('defaults are relative to peers only: CPE best quarter good, engagement bottom quarter warn, 蒲公英 medians ahead of half good', () => {
    expect(defaults.every((h) => h.key === 'health' || h.op.startsWith('percentile'))).toBe(true)
    const flags = highlightFlags(row('pugongying', { health: 'healthy' }, {
      cpe: rank(75),
      engagementRate: rank(25),
      readMedian: rank(50),
      interactionMedian: rank(49.9),
    }), defaults)
    expect(flags).toEqual([
      { key: 'cpe', tone: 'good' },
      { key: 'engagementRate', tone: 'warn' },
      { key: 'readMedian', tone: 'good' },
    ])
  })

  it('the 蒲公英 median highlights stay off for other sources', () => {
    const flags = highlightFlags(row('qiangua', {}, { readMedian: rank(90), interactionMedian: rank(90) }), defaults)
    expect(flags).toEqual([])
  })

  it('health 异常 is a red gate: it shows, and no good dot survives it', () => {
    const flags = highlightFlags(row('pugongying', { health: 'abnormal' }, {
      cpe: rank(99),
      engagementRate: rank(10),
    }), defaults)
    expect(flags).toEqual([
      { key: 'health', tone: 'bad' },
      { key: 'engagementRate', tone: 'warn' },
    ])
  })

  it('no percentile (stale snapshot, fewer than 10 peers) → no percentile highlight', () => {
    expect(highlightFlags(row('pugongying', { cpe: 0.01, health: 'healthy' }, {}), defaults)).toEqual([])
  })

  it('absolute highlights still work and can be scoped by source', () => {
    const highlights = [{ key: 'cpe' as const, op: 'lte' as const, value: 3, tone: 'good' as const, sources: ['xinhong' as const] }]
    expect(highlightFlags(row('xinhong', { cpe: 2 }, {}), highlights)).toEqual([{ key: 'cpe', tone: 'good' }])
    expect(highlightFlags(row('qiangua', { cpe: 2 }, {}), highlights)).toEqual([])
  })

  it('validation accepts the new shapes and rejects bad ones', () => {
    expect(validateSavedQuery(defaultSavedQuery({ name: 'x' }))).toEqual([])
    const bad = [
      { key: 'health', op: 'eq', value: 'healthy', tone: 'bad' },
      { key: 'cpe', op: 'percentileLte', value: 120, tone: 'warn' },
      { key: 'cpe', op: 'lte', value: 3, tone: 'loud' },
      { key: 'cpe', op: 'lte', value: 3, tone: 'good', sources: ['weibo'] },
      { key: 'cpe', op: 'eq', value: 3, tone: 'good' },
    ]
    for (const h of bad) {
      expect(validateSavedQuery(defaultSavedQuery({ name: 'x', highlights: [h as any] })), JSON.stringify(h)).toContain('highlights')
    }
  })

  it('normalizing an old spec keeps the health gate and renames metric keys', () => {
    const q = normalizeSavedQuery({ highlights: [{ key: 'health', op: 'eq', value: 'abnormal', tone: 'bad' }, { key: 'cpv', op: 'lte', value: 1, tone: 'good' }] })
    expect(q.highlights).toEqual([
      { key: 'health', op: 'eq', value: 'abnormal', tone: 'bad' },
      { key: 'cpr', op: 'lte', value: 1, tone: 'good' },
    ])
  })

  it('applySavedQuery flags from the full ranks even when the metric is not a column', () => {
    const rows: QueryRow[] = Array.from({ length: 12 }, (_, i) => ({
      id: `r${i}`,
      creatorKey: `k${i}`,
      displayName: `n${i}`,
      source: 'pugongying',
      regions: [],
      coopBrands: [],
      metrics: { ...emptyMetrics(30), followers: 10_000 + i, cpe: 1 + i, health: 'healthy' },
    }))
    const out = applySavedQuery(rows, defaultSavedQuery({ name: 'x', columns: ['followers'] }))
    const cheapest = out.find((r) => r.id === 'r0')!
    expect(cheapest.flags).toContainEqual({ key: 'cpe', tone: 'good' })
    expect(out.find((r) => r.id === 'r11')!.flags).toEqual([])
  })
})
