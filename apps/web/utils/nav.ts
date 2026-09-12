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

const DESK: NavItem[] = [
  { id: 'ops', href: '/ops', perm: 'ops.read' },
  { id: 'navBatchUpload', href: '/ops/batches/upload', perm: 'ops.read' },
  { id: 'navBatchList', href: '/ops/batches', perm: 'ops.read' },
  { id: 'navCreatorNew', href: '/ops/creators/new', perm: 'ops.read' },
  { id: 'navQc', href: '/ops/qc', perm: 'ops.read' },
  { id: 'navRating', href: '/ops/rating', perm: 'ops.read' },
  { id: 'navReview', href: '/ops/review', perm: 'ops.read' },
  { id: 'navLabel', href: '/ops/label', perm: 'ops.read' },
  { id: 'navPublish', href: '/ops/publish', perm: 'ops.publish' },
  { id: 'dev', href: '/dev', perm: 'dev.read' },
  { id: 'navJobs', href: '/dev/jobs', perm: 'dev.read' },
  { id: 'navFailures', href: '/dev/failures', perm: 'dev.read' },
  { id: 'navPipeline', href: '/dev/pipeline', perm: 'dev.read' },
  { id: 'navAudit', href: '/dev/audit', perm: 'dev.read' },
  { id: 'navI18n', href: '/dev/i18n-theme', perm: 'dev.read' },
  { id: 'ingest', href: '/ingest', perm: 'ingest.read' },
  { id: 'select', href: '/select', perm: 'select.read' },
  { id: 'navProjectNew', href: '/select/projects/new', perm: 'select.write' },
  { id: 'navPool', href: '/select/pool', perm: 'select.read' },
  { id: 'navShortlist', href: '/select/shortlist', perm: 'select.read' },
  { id: 'navExport', href: '/select/export', perm: 'select.read' },
  { id: 'assign', href: '/select/assign', perm: 'select.assign' },
]

export function deskNav(role: Role, desk: 'a' | 'b' | 'c' | 'home' = 'home'): NavItem[] {
  const all = DESK.filter((item) => can(role, item.perm))
  if (desk === 'a') return all.filter((item) => item.href.startsWith('/ops'))
  if (desk === 'b') return all.filter((item) => item.href.startsWith('/dev') || item.href.startsWith('/ingest'))
  if (desk === 'c') return all.filter((item) => item.href.startsWith('/select'))
  return all
}

export function deskOf(path: string): 'a' | 'b' | 'c' | 'home' {
  if (path.includes('/ops')) return 'a'
  if (path.includes('/dev') || path.includes('/ingest')) return 'b'
  if (path.includes('/select')) return 'c'
  return 'home'
}

export function homeFor(role: Role): string {
  if (can(role, 'ops.read')) return '/ops'
  if (can(role, 'select.read')) return '/select'
  if (can(role, 'dev.read')) return '/dev'
  return '/denied'
}
