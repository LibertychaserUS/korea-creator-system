import { scrub } from './ingest/dead-letters'

type Level = 'info' | 'warn' | 'error'

/**
 * One JSON object per line, so a log shipper can index fields without parsing
 * prose. String fields go through the same scrub as stored error messages:
 * vendor errors can carry a token in a URL and logs must not.
 */
export function logEvent(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) safe[key] = typeof value === 'string' ? scrub(value) : value
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...safe })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
