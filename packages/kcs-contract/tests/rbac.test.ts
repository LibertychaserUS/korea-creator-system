import { describe, expect, it } from 'vitest'
import { can, roleFromIdentity, type Permission, type Role } from '../src/rbac'

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
  'admin.secrets',
  'admin.users',
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
      ].sort(),
    )
  })

  it('lets devops monitor and retry jobs but never assign or change prices/publish', () => {
    expect(allowed('devops').sort()).toEqual(
      ['dev.read', 'dev.retry', 'ingest.read', 'ingest.retry'].sort(),
    )
  })

  it('lets selector read the pool, create projects, and assign', () => {
    expect(allowed('selector').sort()).toEqual(
      ['select.read', 'select.write', 'select.assign'].sort(),
    )
  })

  it('lets selector_viewer only read the front pool', () => {
    expect(allowed('selector_viewer')).toEqual(['select.read'])
  })

  it('denies devops select.assign so they cannot pick talent', () => {
    expect(can('devops', 'select.assign')).toBe(false)
  })

  it('denies ops admin.secrets so they cannot change k8s/keys', () => {
    expect(can('ops', 'admin.secrets')).toBe(false)
  })

  it('keeps account management with platform_admin only', () => {
    const roles: Role[] = ['ops', 'devops', 'selector', 'selector_viewer']
    for (const role of roles) expect(can(role, 'admin.users')).toBe(false)
    expect(can('platform_admin', 'admin.users')).toBe(true)
  })

  it('denies selector_viewer select.assign so hide-button-only UI is not enough', () => {
    expect(can('selector_viewer', 'select.assign')).toBe(false)
    expect(can('selector_viewer', 'select.write')).toBe(false)
  })

  it('maps TinyShip identities: KCS roles verbatim, admin → platform_admin, anything else → no access', () => {
    expect(roleFromIdentity('ops')).toBe('ops')
    expect(roleFromIdentity('selector_viewer')).toBe('selector_viewer')
    expect(roleFromIdentity('admin')).toBe('platform_admin')
    expect(roleFromIdentity('user')).toBeNull()
    expect(roleFromIdentity('')).toBeNull()
    expect(roleFromIdentity(null)).toBeNull()
    expect(roleFromIdentity(undefined)).toBeNull()
  })
})
