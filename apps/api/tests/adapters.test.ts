import { describe, expect, it } from 'vitest'
import { pugongyingAdapter, qianguaAdapter, xinhongAdapter } from '../src/adapters'
import { fixturePage } from '../src/adapters/common'

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

  it('蒲公英 fans30GrowthRate "-0.8" is a 0.8% drop', () => {
    const result = pugongyingAdapter.normalize({
      source: 'pugongying', platform: 'xhs', externalId: 'u1', fetchedAt: '',
      payload: { userId: 'u1', name: 'n', fansNum: 10_000, fans30GrowthRate: '-0.8', fans30GrowthNum: '-80' },
    })
    expect(result.ok && result.creator.metrics.followerGrowthRate).toBeCloseTo(-0.008, 10)
    expect(result.ok && result.creator.metrics.followerGrowth).toBe(-80)
  })
})
