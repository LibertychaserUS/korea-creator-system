import { describe, expect, it } from 'vitest'
import {
  attachAiReview,
  attachManualReview,
  assertScoreUnchanged,
  listCreatorRows,
  scoreTriplet,
} from '../../libs/kcs-domain'

describe('INV-01 score triplet stays immutable', () => {
  it('Functional: attaching an AI review does not change final, grade, or rank', () => {
    const row = listCreatorRows()[0]
    const before = scoreTriplet(row.score)
    const after = attachAiReview(row.score, {
      creatorKey: row.creator.creatorKey,
      decision: 'reject',
      source: 'success',
      alignment: 'hard_conflict',
      reason: 'should not rewrite rank',
      riskNote: 'probe',
    })
    assertScoreUnchanged(row.score, after)
    expect(scoreTriplet(after)).toEqual(before)
  })

  it('Negative: attaching a human decision does not write the score triplet', () => {
    const row = listCreatorRows()[1]
    const before = { ...row.score }
    const after = attachManualReview(row.score, {
      creatorKey: row.creator.creatorKey,
      decision: 'reject',
      note: '调性不合',
    })
    expect(after.final).toBe(before.final)
    expect(after.grade).toBe(before.grade)
    expect(after.rank).toBe(before.rank)
  })

  it('Edge: language-layer fields stay source text while scores stay byte-equal', () => {
    const row = listCreatorRows()[0]
    const clone = attachAiReview(row.score, row.aiReview!)
    expect(row.creator.nickname).toBe('서울살림노트')
    expect(row.creator.xhsId).toBe('parkseoulnote')
    expect(row.creator.keywords[0]).toBe('韩国生活')
    expect(JSON.stringify(scoreTriplet(clone))).toBe(JSON.stringify(scoreTriplet(row.score)))
  })
})
