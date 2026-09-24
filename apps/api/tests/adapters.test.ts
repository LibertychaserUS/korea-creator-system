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
