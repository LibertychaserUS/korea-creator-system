import { randomUUID } from 'node:crypto'
import { camelJobs } from '../http/creators'
import type { AppEnv } from '../http/types'
import { parseXlsx } from '../xlsx-sheet'
import { incomingFromSheet, upsertCreatorFromNormalized } from './persist'

/**
 * A workbook ops dropped on the batches page. Runs inline (the file is already
 * here, no vendor is called, so there is nothing for the queue to pace), but
 * every row goes through the same upsert as a queue page.
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
     VALUES ($1,'file-drop','once','running',0,0.1,$2,now(),$3,$4,$5)`,
    [id, openedBy, input.fileName, input.batchName || input.fileName, rows.length],
  )
  let written = 0
  let skipped = 0
  let failed = 0
  for (const row of rows) {
    const incoming = incomingFromSheet(row, env.now())
    if (!incoming) {
      failed += 1
      continue
    }
    try {
      const outcome = await upsertCreatorFromNormalized(env, id, incoming)
      if (outcome.created) written += 1
      else skipped += 1
    } catch {
      failed += 1
    }
  }
  const { rows: jobs } = await env.db.query(
    `UPDATE ingest_jobs SET status = 'ok', written_count = $2, skipped_dupes = $3, failed_count = $4,
       ended_at = now(), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, written, skipped, failed],
  )
  return camelJobs(jobs)[0]
}
