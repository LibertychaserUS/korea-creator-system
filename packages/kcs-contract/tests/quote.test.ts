import { describe, expect, it } from 'vitest'
import { quoteAmount, quoteSum } from '../src/quote'

/**
 * Break: C-shortlist quote-sum stays an em dash because price
 * fields never reach a total helper.
 */
describe('shortlist quote totals', () => {
  it('uses amountMin and falls back to amountMax', () => {
    expect(quoteAmount({ amountMin: 8000, amountMax: 12000, currency: 'CNY' })).toBe(8000)
    expect(quoteAmount({ amountMax: 5500, currency: 'CNY' })).toBe(5500)
    expect(quoteAmount(null)).toBe(0)
  })

  it('sums real API price fields and skips missing quotes', () => {
    expect(
      quoteSum([
        { price: { amountMin: 8000, currency: 'CNY' } },
        { price: { amountMin: 5500, currency: 'CNY' } },
        { price: { amountMin: 6200, currency: 'CNY' } },
        { price: null },
        { price: { amountMin: 4800, currency: 'CNY' } },
        { price: { amountMin: 3500, currency: 'CNY' } },
        { price: { amountMin: 7000, currency: 'CNY' } },
        { price: { amountMin: 5200, currency: 'CNY' } },
      ]),
    ).toBe(40200)
  })
})
