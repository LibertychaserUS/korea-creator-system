import { pgyAccess, type VendorBalanceView } from '@kcs/contract'
import { billedCall, VendorInnerError } from '../adapters/billing'
import { audit } from '../http/audit'
import type { AppEnv } from '../http/types'
import { errorMessage, logEvent } from '../log'
import { scrub } from './dead-letters'

type Json = Record<string, unknown>

/** TikHub's own account endpoint: free, not counted against the quota or budget. */
export const TIKHUB_USER_INFO_PATH = '/api/v1/tikhub/user/get_user_info'

const BALANCE_TIMEOUT_MS = 15_000

/** Below this many dollars left the ops console warns (`TIKHUB_BALANCE_ALERT_USD`, default 5). */
export function balanceAlertUsd(source: NodeJS.ProcessEnv = process.env): number {
  const n = Number(source.TIKHUB_BALANCE_ALERT_USD)
  return source.TIKHUB_BALANCE_ALERT_USD != null && source.TIKHUB_BALANCE_ALERT_USD !== '' && Number.isFinite(n) && n >= 0 ? n : 5
}

function money(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * `data.user_data.balance` / `free_credit` as TikHub documents the answer;
 * flatter shapes are accepted too (待实测 against a live key).
 */
export function readBalance(data: unknown): { balanceUsd: number | null; freeCreditUsd: number | null } {
  const root = data && typeof data === 'object' ? (data as Json) : {}
  const user = root.user_data && typeof root.user_data === 'object' ? (root.user_data as Json) : root
  return {
    balanceUsd: money(user.balance ?? root.balance),
    freeCreditUsd: money(user.free_credit ?? user.freeCredit ?? root.free_credit),
  }
}

export type BalanceCheck =
  | { skipped: 'not_tikhub' }
  | { ok: true; balanceUsd: number | null; freeCreditUsd: number | null; low: boolean; requestId: string | null }
  | { ok: false; error: string }

/**
 * Reads the TikHub balance and keeps the answer. Runs only when 蒲公英 goes
 * through TikHub with a key; a balance under the alert line is written to the
 * audit trail (system actor) so it is on record next to the source pause a
 * 402 would cause.
 */
export async function checkVendorBalance(env: AppEnv, source: NodeJS.ProcessEnv = process.env): Promise<BalanceCheck> {
  const access = pgyAccess(source)
  if (!access || access.gateway !== 'tikhub') return { skipped: 'not_tikhub' }
  try {
    const { value, requestId } = await billedCall(undefined, {
      source: 'pugongying',
      endpoint: `tikhub:${TIKHUB_USER_INFO_PATH}`,
      url: `${access.baseUrl}${TIKHUB_USER_INFO_PATH}`,
      init: { method: 'GET', headers: { authorization: `Bearer ${access.token}` } },
      rule: 'tikhub',
      timeoutMs: BALANCE_TIMEOUT_MS,
      read: (json) => {
        const code = json.code
        if (code != null && Number(code) !== 200) {
          throw new VendorInnerError('tikhub', String(code), String(json.message ?? json.detail ?? ''), String(json.request_id ?? '') || null)
        }
        return { value: readBalance(json.data), empty: json.data == null }
      },
    })
    const { balanceUsd, freeCreditUsd } = value
    await env.db.query(
      `INSERT INTO vendor_balance_checks (vendor, ok, balance_usd, free_credit_usd, request_id) VALUES ('tikhub', true, $1, $2, $3)`,
      [balanceUsd, freeCreditUsd, requestId],
    )
    const available = balanceUsd == null && freeCreditUsd == null ? null : (balanceUsd ?? 0) + (freeCreditUsd ?? 0)
    const low = available != null && available < balanceAlertUsd(source)
    logEvent(low ? 'warn' : 'info', 'vendor.balance', { vendor: 'tikhub', balanceUsd, freeCreditUsd, low, requestId })
    if (low) {
      await audit(env.db, null, 'vendor.balance_low', 'vendor', 'tikhub', `TikHub balance $${available!.toFixed(2)} < $${balanceAlertUsd(source)}`)
    }
    return { ok: true, balanceUsd, freeCreditUsd, low, requestId }
  } catch (error) {
    const message = scrub(errorMessage(error))
    await env.db.query(`INSERT INTO vendor_balance_checks (vendor, ok, error) VALUES ('tikhub', false, $1)`, [message])
    logEvent('warn', 'vendor.balance_failed', { vendor: 'tikhub', message })
    return { ok: false, error: message }
  }
}

/** The latest check plus how long the money lasts at the recent pace; `null` when 蒲公英 is not on TikHub. */
export async function vendorBalanceView(env: AppEnv, source: NodeJS.ProcessEnv = process.env): Promise<VendorBalanceView | null> {
  const access = pgyAccess(source)
  if (!access || access.gateway !== 'tikhub') return null
  const [latest, spend] = await Promise.all([
    env.db.query(
      `SELECT checked_at, ok, balance_usd, free_credit_usd, request_id, error FROM vendor_balance_checks
        WHERE vendor = 'tikhub' ORDER BY checked_at DESC, id DESC LIMIT 1`,
    ),
    env.db.query(
      `SELECT COALESCE(sum(cost_micros), 0)::float8 AS micros, count(*) FILTER (WHERE calls > 0)::int AS days
         FROM ingest_source_usage
        WHERE source = 'pugongying' AND day > (now() AT TIME ZONE 'Asia/Shanghai')::date - 7`,
    ),
  ])
  const row = latest.rows[0]
  const lastGood = row?.ok
    ? row
    : (await env.db.query(
        `SELECT balance_usd, free_credit_usd FROM vendor_balance_checks
          WHERE vendor = 'tikhub' AND ok ORDER BY checked_at DESC, id DESC LIMIT 1`,
      )).rows[0]
  const balanceUsd = money(lastGood?.balance_usd)
  const freeCreditUsd = money(lastGood?.free_credit_usd)
  const availableUsd = balanceUsd == null && freeCreditUsd == null ? null : (balanceUsd ?? 0) + (freeCreditUsd ?? 0)
  const days = Number(spend.rows[0]?.days ?? 0)
  const avgDailyCostUsd = days ? Number(spend.rows[0].micros) / 1_000_000 / days : null
  const alertBelowUsd = balanceAlertUsd(source)
  return {
    vendor: 'tikhub',
    checkedAt: row?.checked_at ? new Date(row.checked_at).toISOString() : null,
    ok: row ? Boolean(row.ok) : null,
    balanceUsd,
    freeCreditUsd,
    availableUsd,
    alertBelowUsd,
    low: availableUsd != null && availableUsd < alertBelowUsd,
    avgDailyCostUsd,
    daysLeft: availableUsd != null && avgDailyCostUsd ? Math.floor(availableUsd / avgDailyCostUsd) : null,
    error: row && !row.ok ? row.error ?? null : null,
    requestId: row?.request_id ?? null,
  }
}
