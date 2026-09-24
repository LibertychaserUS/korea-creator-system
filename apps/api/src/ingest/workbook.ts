import { randomUUID } from 'node:crypto'
import { camelJobs } from '../http/creators'
import type { AppEnv } from '../http/types'
import { parseXlsx, type SheetRow } from '../xlsx-sheet'
import { deadLetterRecord, failureOf } from './dead-letters'
import { readSheetRow, upsertCreatorFromNormalized, type PersistCounts } from './persist'

/** Dead letters of workbook rows carry this as their source. */
export const WORKBOOK_SOURCE = 'file-drop'

/**
 * A workbook ops dropped on the batches page. Runs inline (the file is already
 * here, no vendor is called, so there is nothing for the queue to pace), but
 * every row goes through the same upsert as a queue page. A row that cannot be
 * read or written is parked in the dead-letter list with its cells, like a
 * vendor record, instead of only being counted.
 */
export async function runWorkbookIngest(
  env: AppEnv,
  openedBy: string,
  input: { fileName: string; batchName: string; buf: Buffer },
) {
  const id = randomUUID()
  const rows = parseXlsx(input.buf)
  await env.store.put(
    `batches/${id}/${input.fileName}`,
    input.buf,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  await env.db.query(
    `INSERT INTO ingest_jobs
      (id, source_id, schedule, status, attempt, sample_rate, opened_by, started_at, file_name, batch_name, source_rows)
     VALUES ($1,$2,'once','running',0,0.1,$3,now(),$4,$5,$6)`,
    [id, WORKBOOK_SOURCE, openedBy, input.fileName, input.batchName || input.fileName, rows.length],
  )
  const counts: PersistCounts = { written: 0, skipped: 0, failed: 0 }
  for (const row of rows) {
    const one = await ingestSheetRow(env, id, row, input.fileName)
    counts.written += one.written
    counts.skipped += one.skipped
    counts.failed += one.failed
  }
  const { rows: jobs } = await env.db.query(
    `UPDATE ingest_jobs SET status = 'ok', written_count = $2, skipped_dupes = $3, failed_count = $4,
       ended_at = now(), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, counts.written, counts.skipped, counts.failed],
  )
  return camelJobs(jobs)[0]
}

/** One row → the shared upsert, or the dead-letter list. Also used to replay a parked row. */
export async function ingestSheetRow(
  env: AppEnv,
  jobId: string | null,
  row: SheetRow,
  fileName?: string,
): Promise<PersistCounts> {
  const parked = (code: 'RECORD_INVALID' | 'RECORD_WRITE_FAILED', message: string) =>
    deadLetterRecord(env, {
      jobId,
      source: WORKBOOK_SOURCE,
      raw: {
        externalId: `${jobId ?? 'sheet'}#${row.__line ?? '?'}`,
        payload: { ...row, ...(fileName ? { __file: fileName } : {}) },
      },
      code,
      message,
    }).catch(() => undefined)

  const result = readSheetRow(row, env.now())
  if (!result.ok) {
    await parked('RECORD_INVALID', result.errors.join('; '))
    return { written: 0, skipped: 0, failed: 1 }
  }
  try {
    const outcome = await upsertCreatorFromNormalized(env, jobId, result.incoming)
    return outcome.created ? { written: 1, skipped: 0, failed: 0 } : { written: 0, skipped: 1, failed: 0 }
  } catch (error) {
    await parked('RECORD_WRITE_FAILED', failureOf(error).message)
    return { written: 0, skipped: 0, failed: 1 }
  }
}
