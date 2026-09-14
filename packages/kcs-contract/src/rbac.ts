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
  ],
  devops: ['dev.read', 'dev.retry', 'ingest.read', 'ingest.retry'],
  selector: ['select.read', 'select.write', 'select.assign'],
  selector_viewer: ['select.read'],
}

/**
 * Identity comes from TinyShip (better-auth, `user.role` text column). KCS
 * roles are stored there verbatim; TinyShip's stock `admin` maps to
 * `platform_admin`. Any other value — including the stock `user` that a
 * public sign-up receives — has **no** KCS access: the account exists but
 * has not been given a job yet, so it lands on /denied instead of the pool.
 * Finer-grained access (per org / per project) is layered on top of this via
 * `can()`, never by inventing roles outside this list.
 */
export function roleFromIdentity(raw: string | null | undefined): Role | null {
  if (raw && (ROLES as readonly string[]).includes(raw)) return raw as Role
  if (raw === 'admin') return 'platform_admin'
  return null
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
