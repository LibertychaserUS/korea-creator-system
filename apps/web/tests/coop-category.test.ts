import { describe, expect, it } from 'vitest'
import { coopPressed, selectCoop } from '../utils/coop-category'

/**
 * Break: 合作过 / 没合作过 buttons stay aria-pressed=false after click.
 */
describe('coop_history category toggle', () => {
  it('marks the clicked slug pressed and the other unpressed', () => {
    const current = selectCoop('', 'collaborated')
    expect(coopPressed(current, 'collaborated')).toBe('true')
    expect(coopPressed(current, 'never_collaborated')).toBe('false')
    const next = selectCoop(current, 'never_collaborated')
    expect(coopPressed(next, 'never_collaborated')).toBe('true')
    expect(coopPressed(next, 'collaborated')).toBe('false')
  })
})
