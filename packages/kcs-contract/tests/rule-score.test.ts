import { describe, expect, it } from 'vitest'
import {
  GRADE_THRESHOLDS,
  RULE_DIMENSIONS,
  RULE_VERSION,
  scoreCreator,
} from '../src/rule-score'

/**
 * Break: A-score-preview still invents bars from rating*5 instead of
 * a six-dimension rule module with fixed weights.
 */
describe('six-dimension rule scoring', () => {
  it('exposes the paper weights 25/15/25/20/10/5 and a rule version', () => {
    expect(RULE_VERSION).toMatch(/^rv-/)
    expect(RULE_DIMENSIONS.map((d) => d.id)).toEqual([
      'screening',
      'keywords',
      'koreaBrand',
      'potential',
      'performance',
      'value',
    ])
    expect(RULE_DIMENSIONS.map((d) => d.weight)).toEqual([25, 15, 25, 20, 10, 5])
    expect(GRADE_THRESHOLDS.find((g) => g.grade === 'S')?.min).toBe(85)
    expect(GRADE_THRESHOLDS.find((g) => g.grade === 'A')?.min).toBe(75)
    expect(GRADE_THRESHOLDS.find((g) => g.grade === 'B')?.min).toBe(65)
  })

  it('scores a Korea-beauty creator with six contributions that sum to final', () => {
    const score = scoreCreator({
      followers: 186_000,
      region: '上海 · 韩国',
      persona: '韩妆种草 / 职场女',
      contentTags: ['皮肤护理', '美妆', '空瓶'],
      keywords: ['설화수', '雪花秀', '올리브영', '空瓶'],
      price: 8000,
      hasCollaborated: true,
      collabEr: 0.048,
      readMedian: 124_000,
      interactMedian: 9800,
      noteCount: 40,
    })

    expect(score.ruleVersion).toBe(RULE_VERSION)
    expect(score.dimensions).toHaveLength(6)
    for (const dim of score.dimensions) {
      expect(dim.contribution).toBeGreaterThanOrEqual(0)
      expect(dim.contribution).toBeLessThanOrEqual(dim.weight)
    }
    const parts = score.dimensions.map((d) => d.contribution)
    const recomputed = Number((parts.reduce((a, b) => a + b, 0) + score.riskDeduction).toFixed(1))
    expect(score.final).toBe(recomputed)
    expect(score.final).toBeGreaterThanOrEqual(75)
    expect(['S', 'A']).toContain(score.grade)
    expect(score.hits).toEqual(expect.arrayContaining(['雪花秀', '설화수']))
    expect(score.formula).toContain('=')
    expect(score.formula).toContain(String(score.final))
  })

  it('still returns all six dimensions when fields are missing, with risk reasons', () => {
    const score = scoreCreator({})
    expect(score.dimensions).toHaveLength(6)
    expect(score.riskDeduction).toBeLessThan(0)
    expect(score.riskReasons.length).toBeGreaterThan(0)
    expect(score.grade).toBe('C')
    expect(score.final).toBeGreaterThanOrEqual(0)
    expect(score.final).toBeLessThan(65)
  })

  it('is a pure rule function — the same input always yields the same triplet', () => {
    const input = { followers: 90_000, keywords: ['探店'], price: 12000 }
    expect(scoreCreator(input)).toEqual(scoreCreator(input))
  })
})
