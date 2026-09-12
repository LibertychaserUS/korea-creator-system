import { describe, expect, it } from 'vitest'
import { navItems } from '../utils/nav'

/**
 * Break: selector sees ops/dev entry, or viewer sees assign action.
 */
describe('permission-hidden navigation', () => {
  it('hides ops/dev/ingest from selector roles', () => {
    const ids = navItems('selector').map((i) => i.id)
    expect(ids).toEqual(['select', 'assign'])
    expect(ids).not.toContain('ops')
    expect(ids).not.toContain('dev')
    expect(ids).not.toContain('ingest')
    expect(navItems('selector_viewer').map((i) => i.id)).toEqual(['select'])
  })

  it('hides select from devops and hides assign action for viewer', () => {
    expect(navItems('devops').some((i) => i.id === 'select')).toBe(false)
    expect(navItems('ops').some((i) => i.id === 'select')).toBe(false)
    expect(navItems('selector').some((i) => i.id === 'assign')).toBe(true)
    expect(navItems('selector_viewer').some((i) => i.id === 'assign')).toBe(false)
  })

  it('shows every workspace to platform_admin', () => {
    const ids = navItems('platform_admin').map((i) => i.id)
    expect(ids).toEqual(expect.arrayContaining(['ops', 'dev', 'select', 'ingest']))
  })
})
