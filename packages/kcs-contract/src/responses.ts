import type { IngestJobProgress } from './source-adapter'

/**
 * Response rows the API builds by hand (everything else is `QueryResultRow` /
 * `SavedQuery` / pool rows). Keys are camelCase everywhere; timestamps are ISO strings.
 */

export type IngestJobView = IngestJobProgress & {
  id: string
  sourceId: string
  schedule: string
  attempt: number
  writtenCount: number
  skippedDupes: number
  failedCount: number
  errorCode: string | null
  errorSummary: string | null
  sampleRate: number
  fileName: string | null
  batchName: string | null
  sourceRows: number | null
  query: Record<string, unknown> | null
  sourceMode: string | null
  maxPages: number
  createdAt: string | null
  updatedAt: string | null
  startedAt: string | null
  endedAt: string | null
}

/** `GET /api/ops/batches` rows. */
export type BatchView = IngestJobView & { sourceName: string }

export type OverviewJob = Pick<
  IngestJobView,
  'id' | 'status' | 'writtenCount' | 'failedCount' | 'batchName' | 'fileName' | 'createdAt'
>

export type OpsOverview = {
  counts: { draft: number; review: number; ready: number; released: number; pending: number; withdrawn: number }
  recentJobs: OverviewJob[]
}

/** `GET /api/ops/review` rows. */
export type ReviewView = {
  id: string
  creatorId: string
  displayName: string
  riskLevel: string
  conclusion: string
  status: string
  createdAt: string
}

/** `GET /api/dev/audit` rows. */
export type AuditLogView = {
  id: string
  actorId: string | null
  action: string
  entityType: string
  entityId: string | null
  summary: string
  createdAt: string
}

/** `GET /api/ingest/jobs/:id/sample` rows. */
export type JobSampleView = { id: string; displayName: string; needsReview: boolean }

/** `GET /api/ops/categories` rows. */
export type CategoryView = {
  slug: string
  nameZh: string
  nameEn: string
  nameKo: string
  builtin: boolean
  enabled: boolean
  groupName: string | null
  frontendVisible: boolean
}

/** `GET /api/select/projects` rows; `GET /api/select/projects/:id` adds `assignments`. */
export type ProjectView = {
  id: string
  orgId: string
  name: string
  note: string | null
  status: string
  createdAt: string
  updatedAt: string
  memberCount: number
}

/** `AUTH-DENIED` messages the API sends when the role itself is not allowed (see `requireAuth`). */
export const PERMISSION_DENIED_MESSAGES = ['forbidden', 'no role assigned'] as const

/**
 * Whether a 403 body means "this account may not be here" (→ the denied page)
 * rather than a refusal about this one action, such as `owner_only` when only
 * the author may change who sees a plan (→ said in place). A body without a
 * specific code is treated as a permission refusal.
 */
export function isPermissionDenial(body: unknown): boolean {
  const error = (body as { error?: unknown } | null)?.error
  if (!error || typeof error !== 'object') return true
  const { code, message } = error as { code?: unknown; message?: unknown }
  if (code !== 'AUTH-DENIED') return typeof code !== 'string'
  return typeof message !== 'string' || (PERMISSION_DENIED_MESSAGES as readonly string[]).includes(message)
}
