import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RULE_SPEC,
  nextRuleVersion,
  parseRuleSpec,
  serializeRuleSpec,
  validateRuleSpec,
} from '../src/rule-spec'
import { scoreCreator, scoreCreatorWith, type ScoreInput } from '../src/rule-score'

const sample: ScoreInput = {
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
}

describe('RuleSpec as data', () => {
  it('default spec is valid and reproduces the legacy scorer', () => {
    expect(validateRuleSpec(DEFAULT_RULE_SPEC)).toEqual([])
    expect(scoreCreatorWith(sample, DEFAULT_RULE_SPEC)).toEqual(scoreCreator(sample))
  })

  it('round-trips through JSON including the open-ended cpm ceiling', () => {
    const json = serializeRuleSpec(DEFAULT_RULE_SPEC)
    expect(json).not.toContain('Infinity')
    const back = parseRuleSpec(json)
    expect(back.cpmTiers[back.cpmTiers.length - 1]!.max).toBe(Number.POSITIVE_INFINITY)
    expect(scoreCreatorWith(sample, back)).toEqual(scoreCreatorWith(sample, DEFAULT_RULE_SPEC))
  })

  it('changing a weight changes the final; the version travels with the score', () => {
    const spec = structuredClone(DEFAULT_RULE_SPEC)
    spec.version = 'rv-2026.10'
    spec.weights = spec.weights.map((w) =>
      w.id === 'koreaBrand' ? { ...w, weight: 45 } : w.id === 'screening' ? { ...w, weight: 5 } : w,
    )
    expect(validateRuleSpec(spec)).toEqual([])
    const a = scoreCreatorWith(sample, DEFAULT_RULE_SPEC)
    const b = scoreCreatorWith(sample, spec)
    expect(b.ruleVersion).toBe('rv-2026.10')
    expect(b.final).not.toBe(a.final)
  })

  it('rejects weights that do not sum to 100 and unordered grades', () => {
    const spec = structuredClone(DEFAULT_RULE_SPEC)
    spec.weights[0]!.weight = 30
    expect(validateRuleSpec(spec)).toContain('weights.sum')
    const g = structuredClone(DEFAULT_RULE_SPEC)
    g.grades[1]!.min = 90
    expect(validateRuleSpec(g)).toContain('grades.descending')
    expect(validateRuleSpec(null)).toEqual(['spec.invalid'])
  })

  it('allocates monthly versions with a running suffix', () => {
    const at = new Date('2026-10-05T00:00:00Z')
    expect(nextRuleVersion([], at)).toBe('rv-2026.10')
    expect(nextRuleVersion(['rv-2026.10'], at)).toBe('rv-2026.10-2')
    expect(nextRuleVersion(['rv-2026.10', 'rv-2026.10-2'], at)).toBe('rv-2026.10-3')
  })
})
