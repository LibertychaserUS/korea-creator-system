/**
 * Outcome events (table `creator_events`, migration 0025): what happened to a
 * creator once it reached the pool. Recorded for calibration and for the ingest
 * scheduler's reward ("a discovered creator got published / assigned"); never
 * an input to ranking or percentiles.
 */
export const CREATOR_EVENT_KINDS = ['publish', 'unpublish', 'assign', 'unassign', 'export', 'detail_view'] as const
export type CreatorEventKind = (typeof CREATOR_EVENT_KINDS)[number]

/** The same person opening the same detail page again within this many minutes is one view. */
export const DETAIL_VIEW_DEDUPE_MINUTES = 10

export type CreatorEvent = {
  id: string
  kind: CreatorEventKind
  creatorId: string
  orgId: string | null
  actorId: string | null
  projectId: string | null
  /** The creator's data source when the event happened. */
  source: string | null
  /** publish: `{ republish }`; assign / unassign / export: `{ projectId }` plus `{ locale }` for export. */
  context: Record<string, unknown>
  occurredAt: string
}
