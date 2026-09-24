import type {
  AuditLogView,
  CategoryView,
  JobSampleView,
  OverviewJob,
  ProjectView,
  ReviewView,
} from '@kcs/contract'

type Row = Record<string, any>

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : (value as string | null) ?? null)

export const overviewJobView = (row: Row): OverviewJob => ({
  id: row.id,
  status: row.status,
  writtenCount: Number(row.written_count ?? 0),
  failedCount: Number(row.failed_count ?? 0),
  batchName: row.batch_name ?? null,
  fileName: row.file_name ?? null,
  createdAt: iso(row.created_at),
})

export const reviewView = (row: Row): ReviewView => ({
  id: row.id,
  creatorId: row.creator_id,
  displayName: row.display_name,
  riskLevel: row.risk_level,
  conclusion: row.conclusion,
  status: row.status,
  createdAt: iso(row.created_at)!,
})

export const auditLogView = (row: Row): AuditLogView => ({
  id: row.id,
  actorId: row.actor_id ?? null,
  action: row.action,
  entityType: row.entity_type,
  entityId: row.entity_id ?? null,
  summary: row.summary,
  createdAt: iso(row.created_at)!,
})

export const jobSampleView = (row: Row): JobSampleView => ({
  id: row.id,
  displayName: row.display_name,
  needsReview: Boolean(row.needs_review),
})

export const categoryView = (row: Row): CategoryView => ({
  slug: row.slug,
  nameZh: row.name_zh,
  nameEn: row.name_en,
  nameKo: row.name_ko,
  builtin: Boolean(row.builtin),
  enabled: Boolean(row.enabled),
  groupName: row.group_name ?? null,
  frontendVisible: Boolean(row.frontend_visible),
})

export const projectView = (row: Row): ProjectView => ({
  id: row.id,
  orgId: row.org_id,
  name: row.name,
  note: row.note ?? null,
  status: row.status,
  createdAt: iso(row.created_at)!,
  updatedAt: iso(row.updated_at)!,
  memberCount: Number(row.member_count ?? 0),
})
