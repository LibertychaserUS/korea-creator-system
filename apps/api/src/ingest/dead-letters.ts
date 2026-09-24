import { randomUUID } from 'node:crypto'
import {
  classifyIngestFailure,
  type DeadLetterKind,
  type DeadLetterState,
  type IngestFailureCode,
  type RawRecord,
  type SourceId,
  type SourceQuery,
} from '@kcs/contract'
import type { AppEnv } from '../http/types'

/**
 * The dead-letter list is the queue's memory of everything it could not finish.
 *
 * Two kinds land here and nothing else does:
 *   `job`    — a run that ran out of attempts or failed permanently; keeps the
 *              parameters and the cursor, so a replay continues instead of restarting.
 *   `record` — one creator we could not read or write; keeps the vendor payload
 *              untouched, so a replay can re-read it without calling the vendor again.
 *
 * The queue never retries a dead letter by itself: something needs changing
 * first (a credential, a field map, the vendor's mood), and silently spinning
 * on it would burn paid calls. Ops replays or dismisses.
 */

export type DeadLetterRow = Record<string, any>

export function camelDeadLetters(rows: DeadLetterRow[]) {
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as DeadLetterKind,
    state: row.state as DeadLetterState,
    source: row.source,
    jobId: row.job_id ?? null,
    externalId: row.external_id ?? null,
    code: row.code as IngestFailureCode,
    message: row.message,
    attempts: Number(row.attempts ?? 0),
    replayCount: Number(row.replay_count ?? 0),
    query: row.query ?? null,
    cursor: row.cursor ?? null,
    payload: row.payload ?? null,
    replayJobId: row.replay_job_id ?? null,
    resolvedAt: row.resolved_at ?? null,
    resolvedBy: row.resolved_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }))
}

/** Vendor messages can carry a token in a URL; keep the shape, drop the secret. */
export function scrub(message: string): string {
  return message
    .replace(/(token|key|secret|password|authorization)=([^\s&]+)/gi, '$1=***')
    .replace(/Bearer\s+[\w.\-]+/gi, 'Bearer ***')
    .slice(0, 400)
}

export async function deadLetterJob(
  env: AppEnv,
  input: {
    jobId: string
    source: SourceId | string
    code: IngestFailureCode
    message: string
    attempts: number
    query: SourceQuery | Record<string, unknown> | null
    cursor: string | null
  },
) {
  const { rows } = await env.db.query(
    `INSERT INTO ingest_dead_letters
       (id, kind, state, source, job_id, code, message, attempts, query, cursor)
     VALUES ($1,'job','open',$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      randomUUID(),
      input.source,
      input.jobId,
      input.code,
      scrub(input.message),
      input.attempts,
      input.query ? JSON.stringify(input.query) : null,
      input.cursor,
    ],
  )
  return camelDeadLetters(rows)[0]
}

/**
 * A payload that fails again updates its open entry instead of adding a copy —
 * a broken field map would otherwise write one row per creator per run.
 */
export async function deadLetterRecord(
  env: AppEnv,
  input: {
    jobId: string | null
    source: SourceId | string
    raw: Pick<RawRecord, 'externalId' | 'payload'>
    code: IngestFailureCode
    message: string
  },
) {
  const { rows } = await env.db.query(
    `INSERT INTO ingest_dead_letters
       (id, kind, state, source, job_id, external_id, code, message, attempts, payload)
     VALUES ($1,'record','open',$2,$3,$4,$5,$6,1,$7)
     ON CONFLICT (source, external_id) WHERE kind = 'record' AND state = 'open'
     DO UPDATE SET
       job_id = EXCLUDED.job_id,
       code = EXCLUDED.code,
       message = EXCLUDED.message,
       payload = EXCLUDED.payload,
       attempts = ingest_dead_letters.attempts + 1,
       updated_at = now()
     RETURNING *`,
    [
      randomUUID(),
      input.source,
      input.jobId,
      input.raw.externalId,
      input.code,
      scrub(input.message),
      JSON.stringify(input.raw.payload),
    ],
  )
  return camelDeadLetters(rows)[0]
}

/**
 * A human requeued the run itself (运维端「重试」). Its parked entry is no
 * longer waiting for anyone, so close it and point at the run that took over.
 */
export async function closeJobDeadLetters(
  env: AppEnv,
  jobId: string,
  actorId: string,
  replayJobId: string,
) {
  await env.db.query(
    `UPDATE ingest_dead_letters SET state = 'replayed', replay_count = replay_count + 1,
       replay_job_id = $3, resolved_at = now(), resolved_by = $2, updated_at = now()
     WHERE kind = 'job' AND state = 'open' AND job_id = $1`,
    [jobId, actorId, replayJobId],
  )
}

/** Turn a thrown error into (code, permanent, message) the queue can act on. */
export function failureOf(error: unknown): {
  code: IngestFailureCode
  permanent: boolean
  message: string
  /** The vendor's `Retry-After`, when the failure carried one. */
  retryAfterMs: number | null
} {
  const message = error instanceof Error ? error.message : String(error || 'source unavailable')
  const retryAfter = (error as { retryAfterMs?: unknown } | null)?.retryAfterMs
  return {
    ...classifyIngestFailure(message),
    message: scrub(message),
    retryAfterMs: typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : null,
  }
}
