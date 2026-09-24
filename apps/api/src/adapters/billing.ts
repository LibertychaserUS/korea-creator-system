import type { BillingOutcome, FetchContext, MeterStopReason, SourceId } from '@kcs/contract'
import { parseRetryAfter, readVendorJson, VendorHttpError } from './common'

type Json = Record<string, unknown>

/**
 * The meter refused a call: the day's quota or money budget would be passed,
 * the source is paused, or the run has to stop. Nothing was sent.
 */
export class MeterStop extends Error {
  constructor(
    readonly reason: MeterStopReason,
    readonly resetsAt: string | null,
  ) {
    super(`meter stop: ${reason}`)
    this.name = 'MeterStop'
  }
}

export function isMeterStop(error: unknown): error is MeterStop {
  return error instanceof MeterStop
}

/**
 * Which answers the vendor charges for.
 *   tikhub         — HTTP 200 only (empty data included); 4xx / 5xx are free
 *   every-response — vendors without a published rule: any answer counts
 */
export type BillingRule = 'tikhub' | 'every-response'

export function billingOutcome(rule: BillingRule, status: number): BillingOutcome {
  if (rule === 'tikhub') return status === 200 ? 'billed' : 'unbilled'
  return 'billed'
}

/** Connection errors where the request provably never reached the vendor. */
const NEVER_SENT = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT'])

function networkCode(error: unknown): string | null {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause
  const code = cause?.code ?? (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : null
}

/** The vendor did not answer in time. The request left, so it may have been billed. */
export class VendorTimeoutError extends Error {
  readonly maybeBilled = true
  constructor(
    readonly source: string,
    readonly timeoutMs: number,
  ) {
    super(`${source} timeout after ${timeoutMs}ms (may have been billed)`)
    this.name = 'VendorTimeoutError'
  }
}

/** The vendor could not be reached (`code`) or the answer broke off halfway. */
export class VendorNetworkError extends Error {
  constructor(
    readonly source: string,
    readonly code: string | null,
    readonly maybeBilled: boolean,
  ) {
    super(`${source} unreachable (${code ?? 'network error'})${maybeBilled ? ' (may have been billed)' : ''}`)
    this.name = 'VendorNetworkError'
  }
}

/**
 * A 2xx whose body says the request failed (TikHub: outer `code` ≠ 200, or
 * the relayed 蒲公英 answer has `success: false` / a non-zero `code`). It is
 * billed, and sending the same request again gets the same answer.
 */
export class VendorInnerError extends Error {
  constructor(
    readonly source: string,
    readonly code: string | null,
    readonly detail: string | null,
    readonly requestId: string | null = null,
  ) {
    super(`${source} inner error ${code || '?'}${detail ? `: ${detail.slice(0, 160)}` : ''}`)
    this.name = 'VendorInnerError'
  }
}

export function isVendorInnerError(error: unknown): error is VendorInnerError {
  return error instanceof VendorInnerError
}

/** TikHub puts `request_id` in the body; JustOneAPI `requestId`; some gateways a header. */
export function requestIdOf(json: unknown, response?: Response): string | null {
  const body = json && typeof json === 'object' ? (json as Json) : {}
  const value = body.request_id ?? body.requestId ?? response?.headers.get('x-request-id')
  return value == null || value === '' ? null : String(value)
}

export type BilledRequest<T> = {
  source: SourceId
  /** `<gateway>:<path>` — what the meter prices and the log names. */
  endpoint: string
  url: string
  init: RequestInit
  rule: BillingRule
  timeoutMs: number
  /**
   * Reads a 2xx body into the value the adapter wants and says whether it was
   * empty. Throws for a vendor-level refusal inside a 2xx; the call stays billed.
   */
  read: (json: Json) => { value: T; empty: boolean }
}

export type BilledResult<T> = { value: T; empty: boolean; status: number; requestId: string | null }

/**
 * One paid request: reserve (rate token + one call of the day's quota and
 * budget) → send → settle by the vendor's billing rule. Without a meter in
 * `context` it is a plain request, for callers outside the queue.
 */
export async function billedCall<T>(context: FetchContext | undefined, req: BilledRequest<T>): Promise<BilledResult<T>> {
  const ticket = context?.meter ? await context.meter.acquire(req.endpoint) : null
  const started = Date.now()
  const settle = async (outcome: BillingOutcome, status: number | null, requestId: string | null, empty = false) => {
    await ticket?.settle({ outcome, status, requestId, empty, ms: Date.now() - started })
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), req.timeoutMs)
  let response: Response | null = null
  let status: number | null = null
  let requestId: string | null = null
  try {
    try {
      response = await fetch(req.url, { ...req.init, signal: controller.signal })
    } catch (error) {
      if (controller.signal.aborted) {
        await settle('maybe', null, null)
        throw new VendorTimeoutError(req.source, req.timeoutMs)
      }
      const code = networkCode(error)
      const neverSent = code != null && NEVER_SENT.has(code)
      await settle(neverSent ? 'unbilled' : 'maybe', null, null)
      throw new VendorNetworkError(req.source, code, !neverSent)
    }
    status = response.status
    requestId = response.headers.get('x-request-id')
    const outcome = billingOutcome(req.rule, status)
    if (!response.ok) {
      let body: unknown = null
      try {
        body = await readVendorJson(response)
      } catch {
        // An error page that is not JSON still gets its status reported.
      }
      requestId = requestIdOf(body, response)
      await settle(outcome, status, requestId)
      throw new VendorHttpError(req.source, status, parseRetryAfter(response.headers.get('retry-after')), requestId)
    }
    let json: Json
    try {
      json = await readVendorJson(response)
    } catch {
      if (controller.signal.aborted) {
        await settle('maybe', status, requestId)
        throw new VendorTimeoutError(req.source, req.timeoutMs)
      }
      await settle(outcome, status, requestId)
      throw new VendorNetworkError(req.source, 'invalid body', outcome !== 'unbilled')
    }
    requestId = requestIdOf(json, response)
    let read: { value: T; empty: boolean }
    try {
      read = req.read(json)
    } catch (error) {
      await settle(outcome, status, requestId)
      if (error && typeof error === 'object' && !('requestId' in error)) Object.assign(error, { requestId })
      throw error
    }
    await settle(outcome, status, requestId, read.empty)
    return { ...read, status, requestId }
  } finally {
    clearTimeout(timer)
  }
}
