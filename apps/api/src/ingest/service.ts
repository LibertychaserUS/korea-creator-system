import { randomUUID } from 'node:crypto'
import { deriveMetrics, emptyMetrics, type SourceQuery } from '@kcs/contract'
import { getAdapter } from '../adapters'
import {
  camelJobs,
  coerceSourceQuery,
  saveRelations,
} from '../http/creators'
import type { AppEnv } from '../http/types'
import { creatorKeyFromRow, parseXlsx, type SheetRow } from '../xlsx-sheet'

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
    try {
      const persisted = await persistSheetRow(env, id, row)
      if (persisted === 'written') written += 1
      else if (persisted === 'skipped') skipped += 1
      else failed += 1
    } catch {
      failed += 1
    }
  }
  await env.db.query(
    `UPDATE ingest_jobs SET status = 'ok', written_count = $2, skipped_dupes = $3, failed_count = $4,
       ended_at = now(), updated_at = now()
     WHERE id = $1`,
    [id, written, skipped, failed],
  )
  const { rows: jobs } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [id])
  return camelJobs(jobs)[0]
}

async function persistSheetRow(
  env: AppEnv,
  jobId: string,
  row: SheetRow,
): Promise<'written' | 'skipped' | 'failed'> {
  const displayName = row.displayName || row.xhsId || row.userId
  if (!displayName) return 'failed'
  const key = creatorKeyFromRow(row) || `ck_${randomUUID().slice(0, 8)}`
  const followers = row.followers ? Number(String(row.followers).replace(/[^\d.]/g, '')) : null
  const price = row.price ? Number(String(row.price).replace(/[^\d.]/g, '')) : null
  const regions = row.region ? [row.region] : []
  const verticals = [row.vertical, row.keywords, row.persona].filter(Boolean) as string[]
  const metrics = deriveMetrics({ ...emptyMetrics(), followers, priceImage: price })
  const found = await env.db.query('SELECT id FROM creators WHERE creator_key = $1', [key])
  if (found.rows[0]) {
    await env.db.query(
      `UPDATE creators SET
        display_name = $2, followers = COALESCE($3, followers), regions = $4, verticals = $5,
        metrics = $6, metrics_window = 30, metrics_fetched_at = now(),
        xhs_id = COALESCE($7, xhs_id), last_ingest_job_id = $8, needs_review = true, updated_at = now()
       WHERE creator_key = $1`,
      [
        key,
        displayName,
        Number.isFinite(followers) ? followers : null,
        regions,
        verticals,
        JSON.stringify(metrics),
        row.xhsId || null,
        jobId,
      ],
    )
    return 'skipped'
  }
  const creatorId = randomUUID()
  await env.db.query(
    `INSERT INTO creators
      (id, creator_key, display_name, status, needs_review, followers, followers_unknown, regions, verticals,
       metrics, metrics_window, metrics_fetched_at, xhs_id, last_ingest_job_id, note)
     VALUES ($1,$2,$3,'draft',true,$4,$5,$6,$7,$8,30,now(),$9,$10,$11)`,
    [
      creatorId,
      key,
      displayName,
      Number.isFinite(followers) ? followers : null,
      followers == null,
      regions,
      verticals,
      JSON.stringify(metrics),
      row.xhsId || null,
      jobId,
      row.persona || null,
    ],
  )
  await env.db.query(
    "INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1,'never_collaborated')",
    [creatorId],
  )
  if (price != null && Number.isFinite(price)) {
    await saveRelations(env.db, creatorId, {
      price: { amountMin: price, currency: 'CNY' },
    })
  }
  await env.db.query(
    `INSERT INTO reviews (id, creator_id, risk_level, conclusion, status)
     VALUES ($1,$2,'low','文件投递待校对','pending')`,
    [randomUUID(), creatorId],
  )
  return 'written'
}

export async function runAdapterIngest(
  env: AppEnv,
  query: SourceQuery,
  openedBy: string,
  existing?: Record<string, any>,
) {
  const adapter = getAdapter(query.source)
  if (!adapter) throw new Error(`unsupported adapter: ${query.source}`)
  await env.db.query(
    `INSERT INTO ingest_sources (id, name, adapter_type, enabled, rate_limit, quota, owner)
     VALUES ($1,$2,$1,true,60,1000,'ops') ON CONFLICT (id) DO NOTHING`,
    [
      query.source,
      query.source === 'pugongying' ? '蒲公英' : query.source === 'qiangua' ? '千瓜' : '新红',
    ],
  )
  const id = existing ? String(existing.id) : randomUUID()
  const attempt = existing ? Number(existing.attempt) + 1 : 0
  if (existing) {
    await env.db.query(
      `UPDATE ingest_jobs SET status = 'running', attempt = $2, query = $3, started_at = now(),
       ended_at = NULL, error_code = NULL, error_summary = NULL, updated_at = now() WHERE id = $1`,
      [id, attempt, JSON.stringify(query)],
    )
  } else {
    await env.db.query(
      `INSERT INTO ingest_jobs
       (id, source_id, schedule, status, attempt, sample_rate, opened_by, query, started_at)
       VALUES ($1,$2,'once','running',$3,1,$4,$5,now())`,
      [id, query.source, attempt, openedBy, JSON.stringify(query)],
    )
  }
  let written = 0
  let skipped = 0
  let failed = 0
  let sourceMode: 'live' | 'fixture' = 'live'
  try {
    const page = await adapter.fetch(query)
    sourceMode = (page as { sourceMode?: 'live' | 'fixture' }).sourceMode ?? 'live'
    for (const raw of page.records) {
      const normalized = adapter.normalize(raw)
      if (!normalized.ok) {
        failed += 1
        continue
      }
      try {
        const creator = normalized.creator
        const found = await env.db.query('SELECT id FROM creators WHERE creator_key = $1', [creator.creatorKey])
        const creatorId = found.rows[0]?.id ?? randomUUID()
        await env.db.query(
          `INSERT INTO creators (
             id, creator_key, display_name, status, needs_review, followers, followers_unknown,
             regions, verticals, xhs_id, metrics, metrics_window, source, external_id,
             metrics_fetched_at, last_ingest_job_id
           ) VALUES ($1,$2,$3,'draft',true,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (creator_key) DO UPDATE SET
             display_name = EXCLUDED.display_name,
             needs_review = true,
             followers = EXCLUDED.followers,
             followers_unknown = EXCLUDED.followers_unknown,
             regions = EXCLUDED.regions,
             verticals = EXCLUDED.verticals,
             xhs_id = EXCLUDED.xhs_id,
             metrics = EXCLUDED.metrics,
             metrics_window = EXCLUDED.metrics_window,
             source = EXCLUDED.source,
             external_id = EXCLUDED.external_id,
             metrics_fetched_at = EXCLUDED.metrics_fetched_at,
             last_ingest_job_id = EXCLUDED.last_ingest_job_id,
             updated_at = now()
           RETURNING id`,
          [
            creatorId,
            creator.creatorKey,
            creator.displayName,
            creator.metrics.followers,
            creator.metrics.followers == null,
            creator.regions,
            creator.verticals,
            creator.xhsId,
            JSON.stringify(creator.metrics),
            creator.metrics.window,
            query.source,
            creator.externalId,
            raw.fetchedAt,
            id,
          ],
        )
        const persistedId = found.rows[0]?.id ?? creatorId
        await env.db.query(
          `INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            randomUUID(),
            persistedId,
            query.source,
            raw.externalId,
            raw.fetchedAt,
            JSON.stringify(raw.payload),
          ],
        )
        if (found.rows[0]) skipped += 1
        else written += 1
      } catch {
        failed += 1
      }
    }
    await env.db.query(
      `UPDATE ingest_jobs SET status = 'ok', written_count = $2, skipped_dupes = $3,
       failed_count = $4, source_mode = $5, ended_at = now(), updated_at = now() WHERE id = $1`,
      [id, written, skipped, failed, sourceMode],
    )
  } catch (error) {
    failed += 1
    await env.db.query(
      `UPDATE ingest_jobs SET status = 'failed', failed_count = $2, source_mode = $3,
       error_code = 'SOURCE_UNAVAILABLE', error_summary = $4, ended_at = now(), updated_at = now()
       WHERE id = $1`,
      [
        id,
        failed,
        sourceMode,
        error instanceof Error ? error.message.slice(0, 240) : 'source unavailable',
      ],
    )
  }
  const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [id])
  return camelJobs(rows)[0]
}

export async function runIngest(
  env: AppEnv,
  sourceId: string,
  schedule: string,
  sampleRate: number,
  openedBy: string,
  existing?: Record<string, any>,
) {
  const source = await env.db.query('SELECT adapter_type FROM ingest_sources WHERE id = $1', [sourceId])
  const adapter = getAdapter(String(source.rows[0]?.adapter_type ?? sourceId))
  if (adapter) {
    const query = coerceSourceQuery(existing?.query, adapter.id)
    return runAdapterIngest(env, query, openedBy, existing)
  }
  const id = existing ? String(existing.id) : randomUUID()
  const attempt = existing ? Number(existing.attempt) + 1 : 0
  if (!existing) {
    await env.db.query(
      `INSERT INTO ingest_jobs (id, source_id, schedule, status, attempt, sample_rate, opened_by, started_at)
       VALUES ($1,$2,$3,'running',$4,$5,$6,now())`,
      [id, sourceId, schedule, attempt, sampleRate, openedBy],
    )
  } else {
    await env.db.query(
      `UPDATE ingest_jobs SET status = 'running', attempt = $2, started_at = now(),
       error_summary = null WHERE id = $1`,
      [id, attempt],
    )
  }
  const key = `ingest_${id.slice(0, 8)}`
  const found = await env.db.query('SELECT id FROM creators WHERE creator_key = $1', [key])
  let written = 0
  let skipped = 0
  if (found.rows[0]) {
    skipped = 1
    await env.db.query(
      `UPDATE creators SET needs_review = true, last_ingest_job_id = $2,
       updated_at = now() WHERE creator_key = $1`,
      [key, id],
    )
  } else {
    const creatorId = randomUUID()
    await env.db.query(
      `INSERT INTO creators
       (id, creator_key, display_name, status, needs_review, followers_unknown, regions, last_ingest_job_id)
       VALUES ($1,$2,$3,'draft',true,true,$4,$5)`,
      [creatorId, key, `投递达人 ${id.slice(0, 4)}`, ['서울'], id],
    )
    await env.db.query(
      "INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1,'never_collaborated')",
      [creatorId],
    )
    await env.db.query(
      `INSERT INTO reviews (id, creator_id, risk_level, conclusion, status)
       VALUES ($1,$2,'low','自动写入待校对','pending')`,
      [randomUUID(), creatorId],
    )
    written = 1
  }
  await env.db.query(
    `UPDATE ingest_jobs SET status = 'ok', written_count = $2, skipped_dupes = $3,
     ended_at = now(), updated_at = now() WHERE id = $1`,
    [id, written, skipped],
  )
  const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [id])
  return camelJobs(rows)[0]
}
