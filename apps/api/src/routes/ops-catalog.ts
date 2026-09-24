import { z } from 'zod'
import {
  CATEGORY_SLUG,
  DICTIONARY_KINDS,
  DICTIONARY_MAX_ITEMS,
  SOURCE_IDS,
  type CategoryUsage,
  type DictionaryKind,
  type DictionaryOption,
  type SourceDictionaries,
  type SourceId,
} from '@kcs/contract'
import type { Queryable } from '../db'
import { audit } from '../http/audit'
import { readJson, validationError } from '../http/body'
import { inTransaction } from '../http/published'
import { jsonError } from '../http/responses'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'
import { categoryView } from '../http/views'

const name = z.string().trim().min(1).max(100)

const categoryCreateBody = z.object({
  slug: z.string().regex(CATEGORY_SLUG, 'slug: a–z, 0–9, _; starts with a letter; 2–40 long'),
  names: z.object({ 'zh-CN': name, en: name, ko: name }),
  frontendVisible: z.boolean().optional(),
})

const dictionaryBody = z.object({
  items: z
    .array(z.object({ value: z.string().trim().min(1).max(100), group: z.string().trim().max(100).nullish() }))
    .max(DICTIONARY_MAX_ITEMS),
})

/** Values seen per source: these many is enough to pick from; the rest are typos or long tail. */
const SEEN_LIMIT = 500

const isSource = (value: unknown): value is SourceId => SOURCE_IDS.includes(value as SourceId)
const isKind = (value: unknown): value is DictionaryKind => DICTIONARY_KINDS.includes(value as DictionaryKind)

/**
 * Swaps the platform list for one (source, kind). Order is kept as given
 * (platforms list categories in their own order); duplicates keep the first.
 * The fetch adapters call this after reading the platform's filter options.
 */
export async function replaceSourceDictionary(
  db: AppEnv['db'],
  source: SourceId,
  kind: DictionaryKind,
  items: { value: string; group?: string | null }[],
): Promise<number> {
  const seen = new Set<string>()
  const values: string[] = []
  const groups: (string | null)[] = []
  for (const item of items) {
    const value = item.value.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    values.push(value)
    groups.push(item.group?.trim() || null)
  }
  await inTransaction(db, async (client) => {
    await client.query('DELETE FROM source_dictionaries WHERE source_id = $1 AND kind = $2', [source, kind])
    if (!values.length) return
    await client.query(
      `INSERT INTO source_dictionaries (source_id, kind, value, grp, position)
       SELECT $1, $2, v, g, (o - 1)::int FROM unnest($3::text[], $4::text[]) WITH ORDINALITY AS t(v, g, o)`,
      [source, kind, values, groups],
    )
  })
  return values.length
}

async function seenValues(db: Queryable, source: SourceId, column: 'regions' | 'verticals') {
  const { rows } = await db.query(
    `SELECT btrim(v) AS value, count(DISTINCT c.id)::int AS creators
       FROM creators c CROSS JOIN LATERAL unnest(c.${column}) AS v
      WHERE btrim(v) <> ''
        AND (c.source = $1 OR EXISTS (SELECT 1 FROM creator_sources s WHERE s.creator_id = c.id AND s.source = $1))
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT $2`,
    [source, SEEN_LIMIT],
  )
  return new Map(rows.map((row) => [String(row.value), Number(row.creators)]))
}

export async function sourceDictionaries(db: Queryable, source: SourceId): Promise<SourceDictionaries> {
  const [platform, regions, verticals] = await Promise.all([
    db.query(
      `SELECT kind, value, grp, updated_at FROM source_dictionaries
        WHERE source_id = $1 ORDER BY kind, position, value`,
      [source],
    ),
    seenValues(db, source, 'regions'),
    seenValues(db, source, 'verticals'),
  ])
  const seenBy: Record<DictionaryKind, Map<string, number>> = { category: verticals, region: regions }
  const out: SourceDictionaries = {
    source,
    category: [],
    region: [],
    updatedAt: { category: null, region: null },
  }
  for (const row of platform.rows) {
    const kind = row.kind as DictionaryKind
    const updated = row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)
    if (!out.updatedAt[kind] || updated > out.updatedAt[kind]!) out.updatedAt[kind] = updated
    out[kind].push({ value: row.value, group: row.grp ?? null, origin: 'platform', creators: seenBy[kind].get(row.value) ?? 0 })
  }
  for (const kind of DICTIONARY_KINDS) {
    const listed = new Set(out[kind].map((o) => o.value))
    const extra: DictionaryOption[] = []
    for (const [value, creators] of seenBy[kind]) {
      if (!listed.has(value)) extra.push({ value, group: null, origin: 'seen', creators })
    }
    out[kind].push(...extra)
  }
  return out
}

export function registerOpsCatalogRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/ops/categories/usage', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      'SELECT category_slug AS slug, count(*)::int AS creators FROM creator_categories GROUP BY 1 ORDER BY 1',
    )
    const body: CategoryUsage = { items: rows.map((row) => ({ slug: row.slug, creators: Number(row.creators) })) }
    return context.json(body)
  })

  app.post('/api/ops/categories', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.categories')
    if (denied) return denied
    const { data: body, invalid } = await readJson(context, categoryCreateBody)
    if (invalid) return invalid
    const { rows } = await env.db.query(
      `INSERT INTO categories (slug, name_zh, name_en, name_ko, builtin, enabled, group_name, frontend_visible)
       VALUES ($1, $2, $3, $4, false, true, NULL, $5)
       ON CONFLICT (slug) DO NOTHING RETURNING *`,
      [body.slug, body.names['zh-CN'], body.names.en, body.names.ko, body.frontendVisible ?? true],
    )
    if (!rows[0]) return jsonError(context, 409, 'CONFLICT', 'category_exists')
    await audit(env.db, user!.id, 'category.create', 'category', body.slug, body.names['zh-CN'])
    return context.json(categoryView(rows[0]), 201)
  })

  app.get('/api/ops/dictionaries', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const source = context.req.query('source')
    if (!isSource(source)) {
      return validationError(context, 'invalid_source', [{ path: 'source', message: `one of ${SOURCE_IDS.join(', ')}` }])
    }
    return context.json(await sourceDictionaries(env.db, source))
  })

  app.post('/api/ops/dictionaries/:source/:kind', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.categories')
    if (denied) return denied
    const source = context.req.param('source')
    const kind = context.req.param('kind')
    if (!isSource(source)) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    if (!isKind(kind)) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    const { data: body, invalid } = await readJson(context, dictionaryBody)
    if (invalid) return invalid
    const count = await replaceSourceDictionary(env.db, source, kind, body.items)
    await audit(env.db, user!.id, 'dictionary.replace', 'dictionary', `${source}/${kind}`, String(count))
    return context.json({ source, kind, count })
  })
}
