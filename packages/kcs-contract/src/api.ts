/**
 * HTTP contract the blackbox SPEC-MAP should bind to.
 * Status: 401 unauthenticated, 403 forbidden, 404 hidden/missing, 409 conflict, 400 invalid, 200/201 ok.
 */
export const API = {
  health: { method: 'GET', path: '/api/health', auth: false },
  healthLive: { method: 'GET', path: '/api/health/live', auth: false },
  openapi: { method: 'GET', path: '/api/openapi.json', auth: false },
  /**
   * Identity is TinyShip (better-auth) — sign-in / sign-out happen on the
   * workspace app's own `/api/auth/*`. The API only introspects the session
   * token it receives and returns the KCS role.
   */
  me: { method: 'GET', path: '/api/auth/me', auth: true },
  /**
   * 账号管理同样在工作端源站（TinyShip 那边），不在 API 上；只有 platform_admin。
   * 改角色 / 停用受 API 会话缓存影响，最多 10 秒后在 API 生效。
   */
  accountList: { method: 'GET', path: '/api/kcs-admin/users', perm: 'admin.users', origin: 'workspace' },
  accountCreate: { method: 'POST', path: '/api/kcs-admin/users', perm: 'admin.users', origin: 'workspace' },
  accountPatch: { method: 'PATCH', path: '/api/kcs-admin/users/:id', perm: 'admin.users', origin: 'workspace' },
  opsOverview: { method: 'GET', path: '/api/ops/overview', perm: 'ops.read' },
  opsCreators: { method: 'GET', path: '/api/ops/creators', perm: 'ops.read' },
  opsCreatorCreate: { method: 'POST', path: '/api/ops/creators', perm: 'ops.write' },
  opsCreatorGet: { method: 'GET', path: '/api/ops/creators/:id', perm: 'ops.read' },
  opsCreatorHistory: { method: 'GET', path: '/api/ops/creators/:id/history', perm: 'ops.read' },
  opsCreatorPatch: { method: 'PATCH', path: '/api/ops/creators/:id', perm: 'ops.write' },
  opsPublish: { method: 'POST', path: '/api/ops/creators/:id/publish', perm: 'ops.publish' },
  opsUnpublish: { method: 'POST', path: '/api/ops/creators/:id/unpublish', perm: 'ops.publish' },
  opsCategories: { method: 'GET', path: '/api/ops/categories', perm: 'ops.read' },
  opsCategoryPatch: { method: 'PATCH', path: '/api/ops/categories/:slug', perm: 'ops.categories' },
  opsReview: { method: 'GET', path: '/api/ops/review', perm: 'ops.read' },
  opsReviewPass: { method: 'POST', path: '/api/ops/review/:id/pass', perm: 'ops.write' },
  opsBatches: { method: 'GET', path: '/api/ops/batches', perm: 'ops.read' },
  /** multipart `file` (.xlsx) required; without one 400 `VALIDATION` / `file_required`. */
  opsBatchUpload: { method: 'POST', path: '/api/ops/batches', perm: 'ops.write' },
  pool: { method: 'GET', path: '/api/select/pool', perm: 'select.read' },
  queries: { method: 'GET', path: '/api/select/queries', perm: 'select.read' },
  queryCreate: { method: 'POST', path: '/api/select/queries', perm: 'select.write' },
  queryGet: { method: 'GET', path: '/api/select/queries/:id', perm: 'select.read' },
  queryPatch: { method: 'PATCH', path: '/api/select/queries/:id', perm: 'select.write' },
  queryDelete: { method: 'DELETE', path: '/api/select/queries/:id', perm: 'select.write' },
  queryRun: { method: 'POST', path: '/api/select/queries/run', perm: 'select.read' },
  queryRevisions: { method: 'GET', path: '/api/select/queries/:id/revisions', perm: 'select.read' },
  queryRestore: { method: 'POST', path: '/api/select/queries/:id/restore', perm: 'select.write' },
  metricsPublic: { method: 'GET', path: '/api/metrics/fields', auth: false },
  /** Filters: `source` (empty = no source), `window`, `contentForm`, `tier`, `key`. */
  poolCategories: { method: 'GET', path: '/api/select/categories', perm: 'select.read' },
  poolReferenceLines: { method: 'GET', path: '/api/select/reference-lines', perm: 'select.read' },
  poolCreator: { method: 'GET', path: '/api/select/creators/:id', perm: 'select.read' },
  poolCreatorHistory: { method: 'GET', path: '/api/select/creators/:id/history', perm: 'select.read' },
  projects: { method: 'GET', path: '/api/select/projects', perm: 'select.read' },
  projectCreate: { method: 'POST', path: '/api/select/projects', perm: 'select.write' },
  projectGet: { method: 'GET', path: '/api/select/projects/:id', perm: 'select.read' },
  assign: { method: 'POST', path: '/api/select/projects/:id/assignments', perm: 'select.assign' },
  unassign: { method: 'DELETE', path: '/api/select/projects/:id/assignments/:creatorId', perm: 'select.assign' },
  shortlist: { method: 'GET', path: '/api/select/shortlist', perm: 'select.read' },
  shortlistAdd: { method: 'POST', path: '/api/select/shortlist', perm: 'select.write' },
  exportProject: { method: 'GET', path: '/api/select/projects/:id/export', perm: 'select.read' },
  devHealth: { method: 'GET', path: '/api/dev/health', perm: 'dev.read' },
  devJobs: { method: 'GET', path: '/api/dev/jobs', perm: 'dev.read' },
  devJob: { method: 'GET', path: '/api/dev/jobs/:id', perm: 'dev.read' },
  devRetry: { method: 'POST', path: '/api/dev/jobs/:id/retry', perm: 'dev.retry' },
  devFailures: { method: 'GET', path: '/api/dev/failures', perm: 'dev.read' },
  devPipeline: { method: 'GET', path: '/api/dev/pipeline', perm: 'dev.read' },
  devAudit: { method: 'GET', path: '/api/dev/audit', perm: 'dev.read' },
  devI18n: { method: 'GET', path: '/api/dev/i18n-theme', perm: 'dev.read' },
  /** Per-source bootstrap sample targets with their basis, group sizes, and 25/50/75 reference lines. */
  devCohorts: { method: 'GET', path: '/api/dev/cohorts', perm: 'dev.read' },
  devCapacity: { method: 'GET', path: '/api/dev/capacity', perm: 'dev.read' },
  /** Take today's storage reading now (replaces today's numbers). */
  devCapacitySnapshot: { method: 'POST', path: '/api/dev/capacity/snapshot', perm: 'dev.retry' },
  devDeadLetters: { method: 'GET', path: '/api/dev/dead-letters', perm: 'dev.read' },
  devDeadLetter: { method: 'GET', path: '/api/dev/dead-letters/:id', perm: 'dev.read' },
  devDeadLetterReplay: { method: 'POST', path: '/api/dev/dead-letters/:id/replay', perm: 'dev.retry' },
  devDeadLetterDismiss: { method: 'POST', path: '/api/dev/dead-letters/:id/dismiss', perm: 'dev.retry' },
  ingestSources: { method: 'GET', path: '/api/ingest/sources', perm: 'ingest.read' },
  ingestAdapters: { method: 'GET', path: '/api/ingest/adapters', perm: 'ingest.read' },
  ingestFetch: { method: 'POST', path: '/api/ingest/fetch', perm: 'ingest.write' },
  ingestRaw: { method: 'GET', path: '/api/ingest/raw/:creatorId', perm: 'ingest.read' },
  ingestJobs: { method: 'GET', path: '/api/ingest/jobs', perm: 'ingest.read' },
  /** 410 `GONE`: jobs only start through the queue (`ingestFetch`) or a workbook (`opsBatchUpload`). */
  ingestJobCreate: { method: 'POST', path: '/api/ingest/jobs', perm: 'ingest.write', gone: true },
  ingestJob: { method: 'GET', path: '/api/ingest/jobs/:id', perm: 'ingest.read' },
  ingestSample: { method: 'GET', path: '/api/ingest/jobs/:id/sample', perm: 'ingest.read' },
  ingestJobRetry: { method: 'POST', path: '/api/ingest/jobs/:id/retry', perm: 'ingest.retry' },
  ingestJobCancel: { method: 'POST', path: '/api/ingest/jobs/:id/cancel', perm: 'ingest.write' },
  presign: { method: 'POST', path: '/api/assets/presign', perm: 'ops.write' },
  /** multipart `file` (image, ≤ 5 MB). */
  assetUpload: { method: 'POST', path: '/api/assets', perm: 'ops.write' },
  assetList: { method: 'GET', path: '/api/assets', perm: 'ops.read' },
  assetGet: { method: 'GET', path: '/api/assets/:key', perm: 'ops.read' },
} as const

type QueryValue = string | number | boolean | null | undefined

/**
 * Fills `:param` segments (URI-encoded) and appends a query string, skipping
 * empty values. A missing param throws instead of producing `/api/x/undefined`.
 */
export function apiPath(
  entry: { path: string } | string,
  params: Record<string, string | number> = {},
  query?: Record<string, QueryValue> | URLSearchParams,
): string {
  const template = typeof entry === 'string' ? entry : entry.path
  const path = template.replace(/:([A-Za-z]\w*)/g, (_, name: string) => {
    const value = params[name]
    if (value === undefined || value === '') throw new Error(`apiPath: missing :${name} for ${template}`)
    return encodeURIComponent(String(value))
  })
  const search = query instanceof URLSearchParams ? new URLSearchParams(query) : new URLSearchParams()
  if (query && !(query instanceof URLSearchParams)) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}
