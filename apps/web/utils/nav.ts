import { can, type Role } from '@kcs/contract'

export type NavItem = { id: string; href: string; perm: Parameters<typeof can>[1] }

const ALL: NavItem[] = [
  { id: 'ops', href: '/ops', perm: 'ops.read' },
  { id: 'dev', href: '/dev', perm: 'dev.read' },
  { id: 'ingest', href: '/ingest', perm: 'ingest.read' },
  { id: 'select', href: '/select', perm: 'select.read' },
  { id: 'assign', href: '/select/assign', perm: 'select.assign' },
]

export function navItems(role: Role): NavItem[] {
  return ALL.filter((item) => can(role, item.perm))
}

export function homeFor(role: Role): string {
  if (can(role, 'ops.read')) return '/ops'
  if (can(role, 'select.read')) return '/select'
  if (can(role, 'dev.read')) return '/dev'
  return '/denied'
}
