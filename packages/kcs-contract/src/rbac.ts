export const ROLES = [
  'platform_admin',
  'ops',
  'devops',
  'selector',
  'selector_viewer',
] as const

export type Role = (typeof ROLES)[number]

export const PERMISSIONS = [
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
] as const

export type Permission = (typeof PERMISSIONS)[number]

const GRANTS: Record<Role, readonly Permission[]> = {
  platform_admin: PERMISSIONS,
  ops: [
    'ops.read',
    'ops.write',
    'ops.publish',
    'ops.categories',
    'dev.read',
    'ingest.read',
    'ingest.write',
    'rules.read',
    'rules.publish',
  ],
  devops: ['dev.read', 'dev.retry', 'ingest.read', 'ingest.retry', 'rules.read'],
  selector: ['select.read', 'select.write', 'select.assign', 'rules.read'],
  selector_viewer: ['select.read', 'rules.read'],
}

export function can(role: Role, permission: Permission): boolean {
  return GRANTS[role].includes(permission)
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    const error = new Error('forbidden')
    error.name = 'ForbiddenError'
    throw error
  }
}
