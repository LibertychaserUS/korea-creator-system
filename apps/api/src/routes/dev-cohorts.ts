import { COHORT_RULES, parseCohortGroupKey } from '@kcs/contract'
import { readCalibration } from '../http/published'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'

/** How the pool's percentiles are formed: what each source needs, and what each group has. */
export function registerDevCohortRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/dev/cohorts', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const [calibration, groups, lines] = await Promise.all([
      readCalibration(env.db),
      env.db.query(
        `SELECT group_key, count(*) FILTER (WHERE NOT blacklisted)::int AS size,
                min(ranked_at) AS ranked_from, max(ranked_at) AS ranked_to
           FROM creator_published GROUP BY group_key ORDER BY group_key`,
      ),
      env.db.query('SELECT * FROM cohort_reference_lines ORDER BY group_key, tier, metric'),
    ])
    const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : value == null ? null : String(value))
    return context.json({
      rules: COHORT_RULES,
      calibration,
      groups: groups.rows.map((row) => ({
        key: row.group_key,
        ...parseCohortGroupKey(row.group_key),
        size: row.size,
        rankedFrom: iso(row.ranked_from),
        rankedTo: iso(row.ranked_to),
      })),
      referenceLines: lines.rows.map((row) => ({
        group: row.group_key,
        tier: row.tier,
        key: row.metric,
        n: row.n,
        p25: row.p25,
        p50: row.p50,
        p75: row.p75,
        computedAt: iso(row.computed_at),
      })),
    })
  })
}
