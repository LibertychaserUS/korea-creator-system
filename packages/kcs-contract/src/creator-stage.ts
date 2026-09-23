/**
 * Where a creator sits in the ops review flow. Derived from status plus the
 * publish snapshot time, never stored:
 * - `review`: not in the pool and never published — waiting for ops to check it;
 * - `released`: in the select pool, ranked on the numbers frozen at publish;
 * - `withdrawn`: taken down after a publish; the old snapshot stays until re-published.
 */
export const CREATOR_STAGES = ['review', 'released', 'withdrawn'] as const

export type CreatorStage = (typeof CREATOR_STAGES)[number]

export function creatorStage(input: {
  status: string | null | undefined
  metricsLockedAt?: string | Date | null
}): CreatorStage {
  if (input.status === 'released') return 'released'
  return input.metricsLockedAt ? 'withdrawn' : 'review'
}
