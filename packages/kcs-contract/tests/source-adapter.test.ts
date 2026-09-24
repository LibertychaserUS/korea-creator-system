import { describe, expect, it } from 'vitest'
import { MAX_COUNT, isPlaceholder, parseNumber, toAmount, toCount, toNumber, toRatio } from '../src/source-adapter'

describe('toNumber: what vendors write for a number', () => {
  it.each([
    ['0.07万', 700],
    ['12.3456万', 123456],
    ['1.5亿', 150_000_000],
    ['1.2万', 12_000],
    ['1.2w', 12_000],
    ['53.2W', 532_000],
    ['1.2千', 1_200],
    ['1.2k', 1_200],
    ['1.2M', 1_200_000],
    ['1.2만', 12_000],
    ['3억', 300_000_000],
    ['1,234', 1_234],
    ['1,234.5', 1_234.5],
    ['1 234', 1_234],
    ['１２３４', 1_234],
    ['１.２万', 12_000],
    ['-5', -5],
    ['\u22125', -5],
    ['－5', -5],
    ['-0.8', -0.8],
    [-5, -5],
    ['1e5', 100_000],
    ['1.2E+7', 12_000_000],
    ['.5', 0.5],
    ['5.', 5],
    [' 42 ', 42],
    ['¥1.5万', 15_000],
    ['3e9', 3_000_000_000],
  ] as const)('%j → %d', (input, expected) => {
    expect(toNumber(input)).toBe(expected)
  })

  it('"10万+" keeps the lower bound and says so', () => {
    expect(parseNumber('10万+')).toEqual({ value: 100_000, issue: 'lowerBound' })
  })

  it.each([
    ['1000-5000', 'range'],
    ['5000~8000', 'range'],
    ['1万-2万', 'range'],
    ['1000 至 5000', 'range'],
    ['—', 'placeholder'],
    ['-', 'placeholder'],
    ['--', 'placeholder'],
    ['暂无', 'placeholder'],
    ['N/A', 'placeholder'],
    ['1.234,5', 'unparseable'],
    ['1.2万粉', 'unparseable'],
    ['3.5%', 'unparseable'],
    ['0x10', 'unparseable'],
    ['abc', 'unparseable'],
  ] as const)('%j → null (%s)', (input, issue) => {
    expect(parseNumber(input)).toEqual({ value: null, issue })
  })

  it('empty and non-numbers are null', () => {
    expect(parseNumber(null)).toEqual({ value: null, issue: null })
    expect(parseNumber('')).toEqual({ value: null, issue: null })
    expect(parseNumber(Number.NaN).value).toBeNull()
    expect(parseNumber(Number.POSITIVE_INFINITY).value).toBeNull()
    expect(parseNumber(true).value).toBeNull()
  })

  it('every x.xx万 from 0.01 to 99.99 is an exact integer', () => {
    for (let i = 1; i <= 9999; i += 1) {
      const text = `${(i / 100).toFixed(2)}万`
      const n = toNumber(text)!
      expect(Number.isInteger(n), text).toBe(true)
      expect(n, text).toBe(i * 100)
    }
  })

  it('every x.xxxx万 is an exact integer', () => {
    for (let i = 1; i <= 99_999; i += 7) {
      const text = `${(i / 10_000).toFixed(4)}万`
      expect(toNumber(text), text).toBe(i)
    }
  })
})

describe('toCount / toAmount', () => {
  it('counts are whole, non-negative unless signed, and fit the integer column', () => {
    expect(toCount('0.07万')).toEqual({ value: 700, issue: null })
    expect(toCount(1234.6).value).toBe(1235)
    expect(toCount('-300')).toEqual({ value: null, issue: 'outOfRange' })
    expect(toCount('-300', { signed: true }).value).toBe(-300)
    expect(toCount('3e9')).toEqual({ value: null, issue: 'outOfRange' })
    expect(toCount(MAX_COUNT).value).toBe(MAX_COUNT)
    expect(toCount('10万+')).toEqual({ value: 100_000, issue: 'lowerBound' })
  })

  it('amounts are never negative', () => {
    expect(toAmount('-12')).toEqual({ value: null, issue: 'outOfRange' })
    expect(toAmount('1.5万').value).toBe(15_000)
  })
})

describe('toRatio', () => {
  it('reads percent strings including full-width ％ and signs', () => {
    expect(toRatio('3.5%')).toBeCloseTo(0.035, 10)
    expect(toRatio('3.5％')).toBeCloseTo(0.035, 10)
    expect(toRatio(' 3.5 % ')).toBeCloseTo(0.035, 10)
    expect(toRatio('-2%')).toBeCloseTo(-0.02, 10)
    expect(toRatio('-0.8', true)).toBeCloseTo(-0.008, 10)
  })
})

describe('isPlaceholder', () => {
  it('knows the usual "no data" marks', () => {
    for (const mark of ['-', '—', '--', '暂无', 'null', 'N/A', '／']) expect(isPlaceholder(mark), mark).toBe(true)
    for (const value of ['0', 0, '12', null]) expect(isPlaceholder(value)).toBe(false)
  })
})
