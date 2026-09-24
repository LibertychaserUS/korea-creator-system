import { describe, expect, it } from 'vitest'
import { checkLocaleKeys, flattenMessages } from '../src'

describe('checkLocaleKeys', () => {
  it('passes when every language has the same keys, text and placeholders', () => {
    const result = checkLocaleKeys({
      'zh-CN': { a: '共 {n} 位', b: { c: '好' } },
      en: { a: '{n} in total', b: { c: 'Good' } },
    })
    expect(result.ok).toBe(true)
    expect(result.locales.map((l) => l.keys)).toEqual([2, 2])
  })

  it('names missing, extra, empty and placeholder-mismatched keys', () => {
    const result = checkLocaleKeys(
      {
        'zh-CN': { a: '共 {n} 位', b: '好', c: '在' },
        ko: { a: '{count}명', b: '  ', d: '추가' },
      },
      'zh-CN',
    )
    expect(result.ok).toBe(false)
    const ko = result.locales.find((l) => l.locale === 'ko')!
    expect(ko.missing).toEqual(['c'])
    expect(ko.extra).toEqual(['d'])
    expect(ko.empty).toEqual(['b'])
    expect(ko.placeholderMismatch).toEqual(['a'])
  })

  it('flattens arrays by index and ignores literal {\'@\'}', () => {
    expect(flattenMessages({ steps: [{ title: 'x' }, { title: 'y' }] })).toEqual({ 'steps.0.title': 'x', 'steps.1.title': 'y' })
    expect(checkLocaleKeys({ a: { k: "邮箱 {'@'} 前" }, b: { k: "before {'@'}" } }).ok).toBe(true)
  })
})
