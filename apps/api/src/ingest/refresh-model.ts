/**
 * How often to re-fetch one creator from one source. A creator's numbers are
 * modelled as changing at Poisson rate λ (changes per day). Each refresh sees
 * only whether *something* changed since the last one, so λ is estimated with
 * the Cho & Garcia-Molina (2003) estimator for that kind of observation:
 *
 *   λ̂ = −ln((n − X + 0.5) / (n + 0.5)) / Ī
 *
 * n = refreshes compared with a previous one, X = how many of those found a
 * material change, Ī = mean days between them. The next refresh is due when
 * the chance of a change reaches `targetProbability`: t = −ln(1 − p) / λ̂,
 * held to [minDays, maxDays]. Fewer than `minVisits` comparisons → defaultDays.
 */
export type RefreshModelConfig = {
  targetProbability: number
  minDays: number
  maxDays: number
  defaultDays: number
  minVisits: number
}

export const DEFAULT_REFRESH_MODEL: RefreshModelConfig = {
  targetProbability: 0.5,
  minDays: 1,
  maxDays: 30,
  defaultDays: 7,
  minVisits: 3,
}

function num(value: string | undefined, fallback: number, ok: (n: number) => boolean) {
  const n = Number(value)
  return value !== undefined && value !== '' && Number.isFinite(n) && ok(n) ? n : fallback
}

export function refreshModelConfig(source: NodeJS.ProcessEnv = process.env): RefreshModelConfig {
  const d = DEFAULT_REFRESH_MODEL
  const minDays = num(source.REFRESH_MIN_DAYS, d.minDays, (n) => n > 0)
  const maxDays = num(source.REFRESH_MAX_DAYS, d.maxDays, (n) => n >= minDays)
  return {
    targetProbability: num(source.REFRESH_TARGET_PROBABILITY, d.targetProbability, (n) => n > 0 && n < 1),
    minDays,
    maxDays,
    defaultDays: Math.min(maxDays, Math.max(minDays, num(source.REFRESH_DEFAULT_DAYS, d.defaultDays, (n) => n > 0))),
    minVisits: num(source.REFRESH_MIN_VISITS, d.minVisits, (n) => n >= 1),
  }
}

export function estimateChangeRate(visits: number, changes: number, observedDays: number): number | null {
  if (visits <= 0 || observedDays <= 0) return null
  const x = Math.min(Math.max(0, changes), visits)
  const meanInterval = observedDays / visits
  return x === 0 ? 0 : -Math.log((visits - x + 0.5) / (visits + 0.5)) / meanInterval
}

export function refreshIntervalDays(
  stats: { visits: number; changes: number; observedDays: number },
  config: RefreshModelConfig = DEFAULT_REFRESH_MODEL,
): { rate: number | null; days: number } {
  const rate = estimateChangeRate(stats.visits, stats.changes, stats.observedDays)
  if (rate == null || stats.visits < config.minVisits) return { rate, days: config.defaultDays }
  if (rate <= 0) return { rate, days: config.maxDays }
  const days = -Math.log(1 - config.targetProbability) / rate
  return { rate, days: Math.min(config.maxDays, Math.max(config.minDays, days)) }
}
