import { describe, expect, it } from 'vitest'
import {
  allFilters,
  applySavedQuery,
  defaultSavedQuery,
  emptyMetrics,
  matchesSearch,
  normalizeSavedQuery,
  validateSavedQuery,
  type CreatorMetrics,
  type MetricPercentiles,
  type QueryRow,
} from '../src'

const rank = (percentile: number) => ({ percentile, band: 'middle' as const, n: 40 })

function row(id: string, metrics: Partial<CreatorMetrics>, extra: Partial<QueryRow> = {}): QueryRow {
  return {
    id,
    creatorKey: `key_${id}`,
    displayName: `博主 ${id}`,
    source: 'pugongying',
    regions: [],
    coopBrands: [],
    metrics: { ...emptyMetrics(30), followers: 20_000, ...metrics },
    percentiles: {} as MetricPercentiles,
    ...extra,
  }
}

const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id).sort()

/** Break: an "or" group needs every condition, an "exclude" group drops rows missing a value, or the new spec fields are ignored. */
describe('saved query condition groups and extra filters', () => {
  const rows = [
    row('a', { cpe: 1, viralRate: 0.01 }, { categories: ['beauty'], collabCount: 0, xhsId: 'XHS001' }),
    row('b', { cpe: 5, viralRate: 0.2 }, { categories: ['food'], collabCount: 2 }),
    row('c', { cpe: 5, viralRate: 0.01 }, { categories: ['beauty', 'food'], collabCount: 1, percentiles: { cpe: rank(95) } }),
    row('d', { cpe: null, viralRate: null }, { collabCount: 4 }),
  ]

  it('"any" keeps a row when one condition holds; a missing value fails its condition', () => {
    const q = defaultSavedQuery({ groups: [{ mode: 'any', filters: [{ key: 'cpe', op: 'lte', value: 2 }, { key: 'viralRate', op: 'gte', value: 0.1 }] }] })
    expect(ids(applySavedQuery(rows, q))).toEqual(['a', 'b'])
  })

  it('"exclude" drops a row only when all of its conditions hold; a missing value keeps the row', () => {
    const q = defaultSavedQuery({ groups: [{ mode: 'exclude', filters: [{ key: 'cpe', op: 'gte', value: 4 }, { key: 'viralRate', op: 'lte', value: 0.05 }] }] })
    expect(ids(applySavedQuery(rows, q))).toEqual(['a', 'b', 'd'])
  })

  it('an exclude group on a percentile drops the top-ranked, and empty groups do nothing', () => {
    const q = defaultSavedQuery({
      groups: [
        { mode: 'exclude', filters: [{ key: 'cpe', op: 'percentileGte', value: 90 }] },
        { mode: 'any', filters: [] },
      ],
    })
    expect(ids(applySavedQuery(rows, q))).toEqual(['a', 'b', 'd'])
    expect(applySavedQuery(rows, q).find((r) => r.id === 'a')!.percentiles).toEqual({})
    expect(applySavedQuery([rows[2]], q)).toEqual([])
  })

  it('categories (any of), has-collaborated and collaboration count', () => {
    expect(ids(applySavedQuery(rows, defaultSavedQuery({ categories: ['beauty'] })))).toEqual(['a', 'c'])
    expect(ids(applySavedQuery(rows, defaultSavedQuery({ hasCollaborated: true })))).toEqual(['b', 'c', 'd'])
    expect(ids(applySavedQuery(rows, defaultSavedQuery({ hasCollaborated: false })))).toEqual(['a'])
    expect(ids(applySavedQuery(rows, defaultSavedQuery({ collabCountMin: 1, collabCountMax: 2 })))).toEqual(['b', 'c'])
  })

  it('the saved search matches name, creator key or 小红书号, ignoring case', () => {
    expect(ids(applySavedQuery(rows, defaultSavedQuery({ search: 'xhs00' })))).toEqual(['a'])
    expect(ids(applySavedQuery(rows, defaultSavedQuery({ search: 'KEY_B' })))).toEqual(['b'])
    expect(matchesSearch({ displayName: '博主', creatorKey: 'k', xhsId: null }, '  ')).toBe(true)
  })

  it('percentiles shown include the metrics named inside groups', () => {
    const q = defaultSavedQuery({ columns: ['followers'], highlights: [], groups: [{ mode: 'any', filters: [{ key: 'cpe', op: 'percentileGte', value: 10 }] }] })
    expect(allFilters(q)).toEqual([{ key: 'cpe', op: 'percentileGte', value: 10 }])
    expect(applySavedQuery([rows[2]], q)[0].percentiles).toEqual({ cpe: rank(95) })
  })

  it('normalizes renamed keys inside groups and trims the search', () => {
    const q = normalizeSavedQuery({ groups: [{ mode: 'any', filters: [{ key: 'cpv', op: 'lte', value: 1 }] }], search: '  博主 ' })
    expect(q.groups).toEqual([{ mode: 'any', filters: [{ key: 'cpr', op: 'lte', value: 1 }] }])
    expect(q.search).toBe('博主')
  })

  it('validates the new fields', () => {
    const ok = defaultSavedQuery({
      name: 'x',
      groups: [{ mode: 'exclude', filters: [{ key: 'cpe', op: 'between', value: [1, 2] }] }],
      categories: ['beauty'],
      hasCollaborated: false,
      collabCountMin: 0,
      collabCountMax: 3,
      search: '博主',
      visibility: 'private',
    })
    expect(validateSavedQuery(ok)).toEqual([])
    const bad = (patch: Record<string, unknown>) => validateSavedQuery({ ...ok, ...patch })
    expect(bad({ groups: [{ mode: 'all', filters: [] }] })).toEqual(['groups.shape'])
    expect(bad({ groups: Array.from({ length: 11 }, () => ({ mode: 'any', filters: [] })) })).toEqual(['groups.shape'])
    expect(bad({ groups: [{ mode: 'any', filters: [{ key: 'cpe', op: 'between', value: [1, Number.NaN] }] }] })).toEqual(['filters.between'])
    expect(bad({ filters: [{ key: 'cpe', op: 'percentileLte', value: 1 }] })).toEqual(['filters.op'])
    expect(bad({ collabCountMin: 4 })).toEqual(['collabCount'])
    expect(bad({ hasCollaborated: 1 })).toEqual(['hasCollaborated'])
    expect(bad({ categories: 'beauty' })).toEqual(['categories'])
    expect(bad({ search: 7 })).toEqual(['search'])
    expect(bad({ visibility: 'org' })).toEqual(['visibility'])
  })
})
