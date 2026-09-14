import { describe, expect, it } from 'vitest'
import { can, type Permission, type Role } from '../src/rbac'

/**
 * Break this test catches: a role is granted a permission the product forbids,
 * or a required role cannot perform its workspace job.
 */
const ALL: Permission[] = [
  'ops.read',
  'ops.write',
  'ops.publish',
  'ops.categories',
  'dev.read',
  'dev.retry',
  'ingest.read',
  'ingest.write',
  'ingest.retry',
  'select.read',
  'select.write',
  'select.assign',
  'rules.read',
  'rules.publish',
  'admin.secrets',
]

function allowed(role: Role): Permission[] {
  return ALL.filter((p) => can(role, p))
}

describe('RBAC matrix', () => {
  it('gives platform_admin every permission including secrets', () => {
    expect(allowed('platform_admin').sort()).toEqual([...ALL].sort())
  })

  it('lets ops enter/publish/categorize but never touch secrets, assign, or job retry', () => {
    expect(allowed('ops').sort()).toEqual(
      [
        'ops.read',
        'ops.write',
        'ops.publish',
        'ops.categories',
        'dev.read',
        'ingest.read',
        'ingest.write',
        'rules.read',
        'rules.publish',
      ].sort(),
    )
  })

  it('lets devops monitor and retry jobs but never assign or change prices/publish', () => {
    expect(allowed('devops').sort()).toEqual(
      ['dev.read', 'dev.retry', 'ingest.read', 'ingest.retry', 'rules.read'].sort(),
    )
  })

  it('lets selector read the pool, create projects, and assign', () => {
    expect(allowed('selector').sort()).toEqual(
      ['select.read', 'select.write', 'select.assign', 'rules.read'].sort(),
    )
  })

  it('lets selector_viewer only read the front pool', () => {
    expect(allowed('selector_viewer').sort()).toEqual(['rules.read', 'select.read'])
  })

  it('only ops and platform_admin can publish a rule version', () => {
    expect(can('ops', 'rules.publish')).toBe(true)
    expect(can('platform_admin', 'rules.publish')).toBe(true)
    expect(can('devops', 'rules.publish')).toBe(false)
    expect(can('selector', 'rules.publish')).toBe(false)
  })

  it('denies devops select.assign so they cannot pick talent', () => {
    expect(can('devops', 'select.assign')).toBe(false)
  })

  it('denies ops admin.secrets so they cannot change k8s/keys', () => {
    expect(can('ops', 'admin.secrets')).toBe(false)
  })

  it('denies selector_viewer select.assign so hide-button-only UI is not enough', () => {
    expect(can('selector_viewer', 'select.assign')).toBe(false)
    expect(can('selector_viewer', 'select.write')).toBe(false)
  })
})
