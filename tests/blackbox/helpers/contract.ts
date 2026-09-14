/**
 * Visible HTTP contract for black-box tests.
 * Paths match `packages/kcs-contract/src/api.ts` and `packages/kcs-contract/src/users.ts`.
 * Do not import app/service classes from here.
 */

export const ROLES = [
  'platform_admin',
  'ops',
  'devops',
  'selector',
  'selector_viewer',
] as const

export type Role = (typeof ROLES)[number]

export const SEED_PASSWORD = process.env.BLACKBOX_PASSWORD || 'Kcs!demo2026'

export const SEED_USERS: Record<Role, { email: string; role: Role }> = {
  platform_admin: { email: 'admin@kcs.local', role: 'platform_admin' },
  ops: { email: 'ops@kcs.local', role: 'ops' },
  devops: { email: 'devops@kcs.local', role: 'devops' },
  selector: { email: 'selector@kcs.local', role: 'selector' },
  selector_viewer: { email: 'viewer@kcs.local', role: 'selector_viewer' },
}

export const ERROR = {
  LOGIN: 'AUTH-LOGIN',
  DENIED: 'AUTH-DENIED',
  VALIDATION: 'VALIDATION',
  SOURCE_INVALID: 'SOURCE-INVALID',
  NOT_FOUND: 'NOT-FOUND',
} as const

export const PATHS = {
  health: '/api/health',
  me: '/api/auth/me',
  opsOverview: '/api/ops/overview',
  opsCreators: '/api/ops/creators',
  opsCreator: (id: string) => `/api/ops/creators/${id}`,
  opsPublish: (id: string) => `/api/ops/creators/${id}/publish`,
  opsUnpublish: (id: string) => `/api/ops/creators/${id}/unpublish`,
  opsCategories: '/api/ops/categories',
  opsCategory: (slug: string) => `/api/ops/categories/${slug}`,
  pool: '/api/select/pool',
  metricsFields: '/api/metrics/fields',
  queries: '/api/select/queries',
  queryRun: '/api/select/queries/run',
  poolCreator: (id: string) => `/api/select/creators/${id}`,
  projects: '/api/select/projects',
  project: (id: string) => `/api/select/projects/${id}`,
  assignments: (projectId: string) => `/api/select/projects/${projectId}/assignments`,
  assignment: (projectId: string, creatorId: string) =>
    `/api/select/projects/${projectId}/assignments/${creatorId}`,
  ingestSources: '/api/ingest/sources',
  ingestAdapters: '/api/ingest/adapters',
  ingestFetch: '/api/ingest/fetch',
  ingestRaw: (creatorId: string) => `/api/ingest/raw/${creatorId}`,
  ingestJobs: '/api/ingest/jobs',
  ingestJob: (id: string) => `/api/ingest/jobs/${id}`,
  ingestJobCancel: (id: string) => `/api/ingest/jobs/${id}/cancel`,
  ingestRetry: (id: string) => `/api/ingest/jobs/${id}/retry`,
  devHealth: '/api/dev/health',
  devJobs: '/api/dev/jobs',
  devJob: (id: string) => `/api/dev/jobs/${id}`,
  devRetry: (id: string) => `/api/dev/jobs/${id}/retry`,
  devFailures: '/api/dev/failures',
  devAudit: '/api/dev/audit',
  assetsPresign: '/api/assets/presign',
  assets: '/api/assets',
  asset: (key: string) => `/api/assets/${encodeURIComponent(key)}`,
} as const

/** Endpoints that require a session. Anonymous callers must get AUTH-LOGIN. */
export const PROTECTED_GETS = [
  PATHS.me,
  PATHS.opsOverview,
  PATHS.opsCreators,
  PATHS.opsCategories,
  PATHS.pool,
  PATHS.projects,
  PATHS.ingestSources,
  PATHS.ingestJobs,
  PATHS.devHealth,
  PATHS.devJobs,
  PATHS.devFailures,
  PATHS.assets,
] as const
