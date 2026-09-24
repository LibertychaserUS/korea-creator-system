/**
 * What a source's daily money budget buys in refreshes: how many known
 * creators it keeps current and how often. Shown on the ops console
 * (「参数校准」) in plain words; the scheduler plans with the same numbers.
 */

/** Paid calls one scheduled refresh round costs on average: the base calls plus slow sections spread over their cycle. */
export function expectedRefreshCalls(
  base: number,
  slow: readonly { calls: number; everyDays: number | null }[],
  intervalDays: number,
): number {
  let calls = Math.max(0, base)
  for (const section of slow) {
    if (section.everyDays == null || section.calls <= 0) continue
    calls += section.calls * (section.everyDays <= 0 ? 1 : Math.min(1, intervalDays / section.everyDays))
  }
  return calls
}

/** How many calls a day the scheduler may plan: the call quota and the money budget, whichever is tighter. */
export function schedulerDailyCalls(input: {
  quota: number
  budgetShare: number
  budgetUsd: number | null
  pricePerCallUsd: number | null
}): { calls: number; limitedBy: 'quota' | 'money' } {
  const byQuota = Math.max(0, Math.floor(input.quota * input.budgetShare))
  if (input.budgetUsd == null || !input.pricePerCallUsd || input.pricePerCallUsd <= 0) return { calls: byQuota, limitedBy: 'quota' }
  const byMoney = Math.max(0, Math.floor((input.budgetUsd * input.budgetShare) / input.pricePerCallUsd + 1e-9))
  return byMoney < byQuota ? { calls: byMoney, limitedBy: 'money' } : { calls: byQuota, limitedBy: 'quota' }
}

export type RefreshCoverage = {
  source: string
  limitedBy: 'quota' | 'money'
  budgetUsd: number | null
  pricePerCallUsd: number | null
  /** Calls a day the scheduler may plan, and the refresh part of them. */
  dailyCalls: number
  refreshShare: number
  refreshCallsPerDay: number
  /** Average paid calls one refresh costs (slow sections spread over their cycle). */
  callsPerRefresh: number
  /** Creators of this source the scheduler can refresh. */
  knownCreators: number
  /** The change model's average interval (days) over those creators. */
  modelIntervalDays: number
  /** At the current budget: this many creators, each about every `intervalDays`. */
  coveredCreators: number
  intervalDays: number | null
  /** Refreshes the budget affords a day. */
  refreshesPerDay: number
  /** What keeping every known creator on the model's interval would cost a day (USD); null when calls are unpriced. */
  usdPerDayForAll: number | null
  /** True when the budget keeps every known creator on the model's interval. */
  enough: boolean
}

export function refreshCoverage(input: {
  source: string
  quota: number
  budgetShare: number
  budgetUsd: number | null
  pricePerCallUsd: number | null
  refreshShare: number
  callsPerRefresh: number
  knownCreators: number
  modelIntervalDays: number
}): RefreshCoverage {
  const { calls, limitedBy } = schedulerDailyCalls(input)
  const refreshCallsPerDay = calls * input.refreshShare
  const cost = Math.max(1e-9, input.callsPerRefresh)
  const refreshesPerDay = refreshCallsPerDay / cost
  const interval = Math.max(1e-9, input.modelIntervalDays)
  const demand = input.knownCreators / interval
  const enough = refreshesPerDay + 1e-9 >= demand
  let intervalDays: number | null = null
  if (input.knownCreators > 0 && refreshesPerDay > 0) intervalDays = enough ? input.modelIntervalDays : input.knownCreators / refreshesPerDay
  return {
    source: input.source,
    limitedBy,
    budgetUsd: input.budgetUsd,
    pricePerCallUsd: input.pricePerCallUsd,
    dailyCalls: calls,
    refreshShare: input.refreshShare,
    refreshCallsPerDay,
    callsPerRefresh: input.callsPerRefresh,
    knownCreators: input.knownCreators,
    modelIntervalDays: input.modelIntervalDays,
    coveredCreators: refreshesPerDay > 0 ? input.knownCreators : 0,
    intervalDays,
    refreshesPerDay,
    usdPerDayForAll: input.pricePerCallUsd == null ? null : demand * cost * input.pricePerCallUsd,
    enough,
  }
}
