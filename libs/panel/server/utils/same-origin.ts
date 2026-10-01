import type { H3Event } from 'h3'

/**
 * M-1 CSRF guard for the cookie-authenticated login/logout POSTs. When the
 * request carries an Origin (or Referer) header, its origin must match the
 * request's Host — i.e. the form was submitted from this app, not embedded in
 * a foreign page. Requests without either header (curl, SSR, tooling) are
 * allowed through, preserving non-browser usability.
 */
export function isSameOrigin(source: string, host: string): boolean {
  if (source === 'null') return false
  try {
    const url = new URL(source)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.host === host
  } catch {
    // Not a parseable absolute URL (browsers always send one); don't break
    // clients that invent odd header values — the check targets real browsers.
    return true
  }
}

export function isSameOriginRequest(event: H3Event): boolean {
  const host = getHeader(event, 'host')
  if (!host) return true
  const source = getHeader(event, 'origin') || getHeader(event, 'referer')
  if (!source) return true
  return isSameOrigin(source, host)
}
