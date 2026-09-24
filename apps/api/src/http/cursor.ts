/**
 * Keyset cursors for the pool lists: the boundary row's sort values and id,
 * signed so a client can only hand back what the server gave it.
 *
 * Sort values travel as the 8 bytes of the float8 (hex), read with
 * `float8send` — exact whatever `extra_float_digits` the server runs with,
 * and `Infinity` survives. The fingerprint ties a cursor to the filters and
 * sort it was made for.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { CURSOR_MAX_LENGTH } from '@kcs/contract'
import { logEvent } from '../log'

export type CursorPayload = {
  v: 1
  /** Fingerprint of the list + filters + sort. */
  f: string
  /** 'n': rows after the boundary; 'p': rows before it. */
  d: 'n' | 'p'
  /** Sort values of the boundary row (float8 bytes as hex, or null). */
  k: Array<string | null>
  id: string
  /** Page the result is: shown as `page` so the pager keeps counting. */
  page: number
}

export class CursorError extends Error {
  constructor(readonly code: 'cursor_invalid' | 'cursor_mismatch') {
    super(code)
  }
}

let secret: Buffer | null = null
function key(): Buffer {
  if (secret) return secret
  const configured = process.env.KCS_CURSOR_SECRET || process.env.BETTER_AUTH_SECRET
  if (configured) secret = createHash('sha256').update(`kcs-cursor:${configured}`).digest()
  else {
    // Fine for one process; several replicas need a shared secret or cursors fail over to page 1.
    secret = randomBytes(32)
    logEvent('warn', 'cursor.ephemeral_secret', { hint: 'set KCS_CURSOR_SECRET' })
  }
  return secret
}

const b64 = (buf: Buffer) => buf.toString('base64url')

function sign(body: string): Buffer {
  return createHmac('sha256', key()).update(body).digest()
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object).sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export function fingerprint(parts: unknown): string {
  return createHash('sha256').update(stable(parts)).digest('base64url').slice(0, 22)
}

export function encodeCursor(payload: CursorPayload): string {
  const body = b64(Buffer.from(JSON.stringify(payload)))
  return `${body}.${b64(sign(body))}`
}

export function decodeCursor(raw: string, expected: string): CursorPayload {
  if (raw.length > CURSOR_MAX_LENGTH) throw new CursorError('cursor_invalid')
  const [body, mac, extra] = raw.split('.')
  if (!body || !mac || extra !== undefined) throw new CursorError('cursor_invalid')
  const given = Buffer.from(mac, 'base64url')
  const want = sign(body)
  if (given.length !== want.length || !timingSafeEqual(given, want)) throw new CursorError('cursor_invalid')
  let payload: CursorPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    throw new CursorError('cursor_invalid')
  }
  if (payload?.v !== 1 || (payload.d !== 'n' && payload.d !== 'p') || !Array.isArray(payload.k)
    || typeof payload.id !== 'string' || !Number.isInteger(payload.page) || payload.page < 1) {
    throw new CursorError('cursor_invalid')
  }
  if (payload.f !== expected) throw new CursorError('cursor_mismatch')
  return payload
}

export function hexToFloat(hex: string | null): number | null {
  if (hex == null) return null
  if (!/^[0-9a-f]{16}$/.test(hex)) throw new CursorError('cursor_invalid')
  return Buffer.from(hex, 'hex').readDoubleBE(0)
}

/** `float8send` comes back from pg as a Buffer. */
export function bytesToHex(value: unknown): string | null {
  if (value == null) return null
  return Buffer.isBuffer(value) ? value.toString('hex') : String(value).replace(/^\\x/, '')
}
