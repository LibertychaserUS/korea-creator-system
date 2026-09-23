import { describe, expect, it } from 'vitest'
import { creatorStage } from '../src'

describe('creatorStage', () => {
  it('released is in the pool whatever the snapshot time', () => {
    expect(creatorStage({ status: 'released', metricsLockedAt: '2026-09-01T00:00:00Z' })).toBe('released')
    expect(creatorStage({ status: 'released', metricsLockedAt: null })).toBe('released')
  })

  it('never published waits for review', () => {
    expect(creatorStage({ status: 'draft' })).toBe('review')
    expect(creatorStage({ status: 'ready', metricsLockedAt: null })).toBe('review')
  })

  it('taken down after a publish keeps its snapshot and reads as withdrawn', () => {
    expect(creatorStage({ status: 'ready', metricsLockedAt: new Date() })).toBe('withdrawn')
  })
})
