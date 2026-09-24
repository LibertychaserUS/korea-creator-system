import type { CallMeter, CallSettlement } from '@kcs/contract'
import { MeterStop } from '../src/adapters/billing'

/** A meter that records what it was asked for; refuses with `reason` after `limit` calls. */
export function recordingMeter(limit = Number.POSITIVE_INFINITY, reason: 'quota' | 'budget' = 'quota') {
  const acquired: string[] = []
  const settled: (CallSettlement & { endpoint: string })[] = []
  const meter: CallMeter = {
    async acquire(endpoint) {
      if (acquired.length >= limit) throw new MeterStop(reason, '2026-09-25T16:00:00.000Z')
      acquired.push(endpoint)
      return {
        async settle(result) {
          settled.push({ ...result, endpoint })
        },
      }
    },
  }
  return { meter, acquired, settled }
}
