/**
 * Paid vendor calls. Every request that can cost money goes through a meter
 * that takes a rate token and reserves one call (and its price) from the
 * source's day *before* the request leaves; the vendor's billing rule then
 * decides whether the reservation stands:
 *
 *   billed   — the vendor charges for it (TikHub: any HTTP 200, empty data included)
 *   unbilled — the vendor does not (TikHub: every non-200 answer); the call and its price go back
 *   maybe    — we cannot know (timeout after the request was sent); kept as billed
 *
 * So a page that fans out to 81 calls is 81 reservations, and the daily call
 * quota and money budget stop the job at the exact call that would pass them.
 */

export type BillingOutcome = 'billed' | 'unbilled' | 'maybe'

export type CallSettlement = {
  outcome: BillingOutcome
  /** HTTP status, `null` when no answer came back. */
  status: number | null
  /** The vendor's own id for the request (TikHub `request_id`), for support tickets. */
  requestId: string | null
  /** An answer with nothing in it (TikHub 200 + `data: null`): billed, counted as 查无结果. */
  empty?: boolean
  ms: number
}

export interface CallTicket {
  settle(result: CallSettlement): Promise<void>
}

export interface CallMeter {
  /**
   * Waits for a rate token and reserves one call of `endpoint` (`<gateway>:<path>`).
   * Throws when the day's quota or budget would be passed, or the run has to stop.
   */
  acquire(endpoint: string): Promise<CallTicket>
}

/** What the queue hands an adapter with each page. Adapters called without one run unmetered (tests, tools). */
export type FetchContext = {
  meter?: CallMeter
}

export const METER_STOP_REASONS = ['quota', 'budget', 'paused', 'stopping'] as const
export type MeterStopReason = (typeof METER_STOP_REASONS)[number]

/**
 * Why a page ended early. Records fetched before it are still on the page
 * (they were paid for) and `nextCursor` points at the first item not fetched.
 */
export type PageInterruption =
  | { reason: MeterStopReason; resetsAt: string | null }
  | { reason: 'error'; error: unknown }

/** Something a vendor call said that is not a record: nothing found, or a refusal for one item. */
export type VendorNote = {
  kind: 'empty' | 'innerError' | 'fetchFailed'
  endpoint: string
  externalId: string | null
  code: string | null
  message: string | null
  requestId: string | null
}

export const MICROS_PER_USD = 1_000_000

/**
 * List prices per call in USD, longest `<gateway>:<path>` prefix wins.
 * TikHub (docs/pricing, 2026-09): 蒲公英 $0.02 per call (note comments $0.01,
 * note components free), App/Web XHS $0.01, account endpoints free; no free
 * credit or volume discount on 小红书 endpoints. JustOneAPI / 千瓜 / 新红 have no
 * published per-call price: their calls count against the call quota but not
 * the money budget until ops set a price (`KCS_VENDOR_PRICES`).
 */
export const VENDOR_PRICES_USD: Readonly<Record<string, number>> = {
  'tikhub:/api/v1/xiaohongshu/pgy/': 0.02,
  'tikhub:/api/v1/xiaohongshu/pgy/get_note_comments': 0.01,
  'tikhub:/api/v1/xiaohongshu/pgy/get_note_components': 0,
  'tikhub:/api/v1/xiaohongshu/app_v2/': 0.01,
  'tikhub:/api/v1/xiaohongshu/web_v3/': 0.01,
  'tikhub:/api/v1/tikhub/': 0,
  'tikhub:/api/v1/health/': 0,
}

/** Price of one call, `null` when nobody has priced this endpoint. */
export function vendorPriceUsd(endpoint: string, overrides: Readonly<Record<string, number>> = {}): number | null {
  let best: { length: number; usd: number } | null = null
  for (const table of [VENDOR_PRICES_USD, overrides]) {
    for (const [prefix, usd] of Object.entries(table)) {
      if (!endpoint.startsWith(prefix) || !Number.isFinite(usd) || usd < 0) continue
      // An override of the same prefix replaces the list price.
      if (!best || prefix.length >= best.length) best = { length: prefix.length, usd }
    }
  }
  return best ? best.usd : null
}

export function usdToMicros(usd: number): number {
  return Math.round(usd * MICROS_PER_USD)
}

export function microsToUsd(micros: number): number {
  return micros / MICROS_PER_USD
}
