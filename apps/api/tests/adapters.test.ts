import { describe, expect, it } from 'vitest'
import { pugongyingAdapter, qianguaAdapter, xinhongAdapter } from '../src/adapters'
import { fieldMapFromEnv, fixturePage, normalizeRecord, type FieldMap } from '../src/adapters/common'

describe.each([pugongyingAdapter, qianguaAdapter, xinhongAdapter])('$id adapter', (adapter) => {
  it('normalizes every fixture without inventing missing values', () => {
    const page = fixturePage(
      adapter.id,
      new URL(`../src/adapters/fixtures/${adapter.id}.json`, import.meta.url),
      { source: adapter.id, window: 30 },
    )
    expect(page.sourceMode).toBe('fixture')
    expect(page.records.length).toBeGreaterThanOrEqual(8)
    for (const raw of page.records) {
      const result = adapter.normalize(raw)
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.creator.creatorKey).toBe(`${adapter.id}:${result.creator.externalId}`)
      expect(result.creator.metrics.cpe).not.toBeNull()
      expect(result.creator.metrics.engagementRate).not.toBeNull()
      expect(['excellent', 'normal', 'abnormal']).toContain(result.creator.metrics.health)
    }
  })
})

describe('vendor values reach the metrics as numbers', () => {
  const qg = (payload: Record<string, unknown>) => {
    const result = qianguaAdapter.normalize({ source: 'qiangua', platform: 'xhs', externalId: 'x', fetchedAt: '', payload: { 达人ID: 'x', 昵称: 'n', ...payload } })
    if (!result.ok) throw new Error(result.errors.join())
    return result.creator
  }

  it('a placeholder does not hide a later alias', () => {
    expect(qg({ 粉丝数: '-', fans_count: 5000 }).metrics.followers).toBe(5000)
    expect(qg({ 粉丝数: '暂无', followers: '1.2万' }).metrics.followers).toBe(12_000)
  })

  it('万 counts are exact integers; bad values are null with a reason', () => {
    const creator = qg({ 粉丝数: '0.07万', 阅读中位数: '12.3456万', 涨粉: '−1,200', 预估报价: '5000-8000', 互动中位数: '-300' })
    expect(creator.metrics.followers).toBe(700)
    expect(creator.metrics.readMedian).toBe(123_456)
    expect(creator.metrics.followerGrowth).toBe(-1_200)
    expect(creator.metrics.priceImage).toBeNull()
    expect(creator.metrics.interactionMedian).toBeNull()
    expect(creator.warnings).toEqual(expect.arrayContaining(['priceImage.range', 'interactionMedian.outOfRange']))
  })

  it('a follower count past the integer column is rejected, not written', () => {
    const creator = qg({ 粉丝数: '30亿' })
    expect(creator.metrics.followers).toBeNull()
    expect(creator.warnings).toContain('followers.outOfRange')
  })

  it('千瓜 0 for CPE, quote or read median means not shown, not free', () => {
    const creator = qg({ CPE: 0, 预估报价: '0', 阅读中位数: 0, 近30天发文: 0, 涨粉: 0 })
    expect(creator.metrics.cpe).toBeNull()
    expect(creator.metrics.priceImage).toBeNull()
    expect(creator.metrics.readMedian).toBeNull()
    expect(creator.warnings).toEqual(expect.arrayContaining(['cpe.notShown', 'priceImage.notShown', 'readMedian.notShown']))
    expect(creator.metrics.noteCount).toBe(0)
    expect(creator.metrics.followerGrowth).toBe(0)
  })

  it('a 0 under one alias does not hide a shown value under the next', () => {
    expect(qg({ 预估报价: 0, 图文报价: '1.2万' }).metrics.priceImage).toBe(12_000)
  })

  it('蒲公英 fans30GrowthRate "-0.8" is a 0.8% drop', () => {
    const result = pugongyingAdapter.normalize({
      source: 'pugongying', platform: 'xhs', externalId: 'u1', fetchedAt: '',
      payload: { userId: 'u1', name: 'n', fansNum: 10_000, fans30GrowthRate: '-0.8', fans30GrowthNum: '-80' },
    })
    expect(result.ok && result.creator.metrics.followerGrowthRate).toBeCloseTo(-0.008, 10)
    expect(result.ok && result.creator.metrics.followerGrowth).toBe(-80)
  })
})

describe('ratio units are declared per field, never guessed from size', () => {
  const qg = (payload: Record<string, unknown>) => {
    const result = qianguaAdapter.normalize({ source: 'qiangua', platform: 'xhs', externalId: 'x', fetchedAt: '', payload: { 达人ID: 'x', 昵称: 'n', ...payload } })
    if (!result.ok) throw new Error(result.errors.join())
    return result.creator
  }

  it('a percent field reads "91" and 0.8 as 91% and 0.8%', () => {
    const creator = qg({ 粉丝真实度: '91', 爆文率: 0.8 })
    expect(creator.metrics.authenticity).toBeCloseTo(0.91, 10)
    expect(creator.metrics.viralRate).toBeCloseTo(0.008, 10)
  })

  it('a trailing % is a percent whatever the field says', () => {
    expect(qg({ 粉丝真实度: '91.5％' }).metrics.authenticity).toBeCloseTo(0.915, 10)
  })

  it('a share outside 0–1 is refused with a reason', () => {
    const creator = qg({ 粉丝真实度: '130' })
    expect(creator.metrics.authenticity).toBeNull()
    expect(creator.warnings).toContain('authenticity.outOfRange')
  })

  it('a ratio field keeps 1.2 as 120% instead of shrinking it', () => {
    const map: FieldMap = { externalId: ['id'], displayName: ['name'], engagementRate: ['rate'] }
    const result = normalizeRecord({ source: 'qiangua', platform: 'xhs', externalId: 'x', fetchedAt: '', payload: { id: 'x', name: 'n', rate: 1.2 } }, map)
    expect(result.ok && result.creator.metrics.engagementRate).toBe(1.2)
  })

  it('蒲公英 percent strings and fractions each keep their own unit', () => {
    const result = pugongyingAdapter.normalize({
      source: 'pugongying', platform: 'xhs', externalId: 'u1', fetchedAt: '',
      payload: {
        userId: 'u1', name: 'n',
        notesRate: { interactionRate: '4.2', videoFullViewRate: '130', pagePercentVo: { readSearchPercent: 0.35 } },
      },
    })
    if (!result.ok) throw new Error(result.errors.join())
    expect(result.creator.metrics.engagementRate).toBeCloseTo(0.042, 10)
    expect(result.creator.metrics.trafficSearchRatio).toBe(0.35)
    expect(result.creator.metrics.retentionRate).toBeNull()
    expect(result.creator.warnings).toContain('retentionRate.outOfRange')
  })

  it('an env field map can declare the unit, and a bare path list keeps the default unit', () => {
    const defaults: FieldMap = { authenticity: { paths: ['a'], unit: 'percent' }, engagedFanRatio: { paths: ['b'], unit: 'percent' } }
    process.env.KCS_TEST_FIELD_MAP = JSON.stringify({ authenticity: ['real'], engagedFanRatio: { paths: ['engaged'], unit: 'ratio' } })
    try {
      const map = fieldMapFromEnv('KCS_TEST_FIELD_MAP', defaults)
      expect(map.authenticity).toEqual({ paths: ['real'], unit: 'percent' })
      expect(map.engagedFanRatio).toEqual({ paths: ['engaged'], unit: 'ratio' })
    } finally {
      delete process.env.KCS_TEST_FIELD_MAP
    }
  })
})
