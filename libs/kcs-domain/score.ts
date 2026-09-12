import type { AIReview, ManualReview, Score } from './types'

/** Score.final / grade / rank are produced only by the rule engine. */
export function freezeScore(score: Score): Score {
  return Object.freeze({
    ...score,
    dimensions: Object.freeze({ ...score.dimensions }),
  })
}

export function scoreTriplet(score: Score) {
  return {
    final: score.final,
    grade: score.grade,
    rank: score.rank,
  }
}

export function attachAiReview(score: Score, _review: AIReview): Score {
  return freezeScore({ ...score, dimensions: { ...score.dimensions } })
}

export function attachManualReview(score: Score, _review: ManualReview): Score {
  return freezeScore({ ...score, dimensions: { ...score.dimensions } })
}

export function assertScoreUnchanged(before: Score, after: Score): void {
  if (
    before.final !== after.final
    || before.grade !== after.grade
    || before.rank !== after.rank
  ) {
    throw new Error('Score triplet is immutable: AI/manual must not write final, grade, or rank')
  }
}
