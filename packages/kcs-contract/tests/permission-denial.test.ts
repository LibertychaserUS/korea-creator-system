import { describe, expect, it } from 'vitest'
import { isPermissionDenial } from '../src'

describe('403 kinds', () => {
  it('role refusals go to the denied page', () => {
    expect(isPermissionDenial({ error: { code: 'AUTH-DENIED', message: 'forbidden' } })).toBe(true)
    expect(isPermissionDenial({ error: { code: 'AUTH-DENIED', message: 'no role assigned' } })).toBe(true)
    expect(isPermissionDenial({ error: { code: 'AUTH-DENIED' } })).toBe(true)
  })

  it('a body without a code (Nitro createError, empty, not JSON) counts as a role refusal', () => {
    expect(isPermissionDenial({ statusCode: 403, statusMessage: 'forbidden' })).toBe(true)
    expect(isPermissionDenial({})).toBe(true)
    expect(isPermissionDenial(null)).toBe(true)
    expect(isPermissionDenial({ error: 'forbidden' })).toBe(true)
  })

  it('a refusal about this one action stays on the page', () => {
    expect(isPermissionDenial({ error: { code: 'AUTH-DENIED', message: 'owner_only' } })).toBe(false)
    expect(isPermissionDenial({ error: { code: 'PROJECT-LOCKED', message: 'locked' } })).toBe(false)
  })
})
