/**
 * H-1 login brute-force protection (audit fix). better-auth's built-in limiter
 * does not apply to server-side `auth.api.*` calls, so `__login.post.ts` had no
 * effective throttling. This is a per-client-IP fail counter over an in-process
 * Map (single-instance deployment):
 *
 *   - 5 failed attempts within a rolling 10-minute window → lock the IP for
 *     15 minutes;
 *   - a locked IP is refused before the password is even checked;
 *   - a successful sign-in resets the IP's history;
 *   - a periodic sweeper drops expired entries so the Map stays bounded.
 *
 * Everything here is a pure function over an explicitly passed store and
 * `now()` (epoch ms) so the window/lock/sweep logic is unit-testable without
 * a Nuxt runtime. Time values are milliseconds since epoch.
 */

export const LOGIN_WINDOW_MS = 10 * 60 * 1000
export const LOGIN_MAX_FAILURES = 5
export const LOGIN_LOCK_MS = 15 * 60 * 1000

type AttemptState = {
  /** Timestamps of failed attempts still inside the rolling window. */
  failures: number[]
  /** Epoch ms until which the IP is locked, or null. */
  lockedUntil: number | null
}

export type LoginRateLimitStore = Map<string, AttemptState>

export function createLoginRateLimitStore(): LoginRateLimitStore {
  return new Map()
}

/** Live store for the Nitro process. */
export const loginRateLimitStore = createLoginRateLimitStore()

/**
 * True while the IP is locked. Expired locks are cleared lazily so the sweeper
 * is the only path that has to care about garbage collection.
 */
export function isLoginLocked(store: LoginRateLimitStore, ip: string, now: number): boolean {
  const state = store.get(ip)
  if (state == null || state.lockedUntil == null) return false
  if (state.lockedUntil > now) return true
  state.lockedUntil = null
  return false
}

/**
 * Records one failed attempt. The window is rolling: only failures newer than
 * `now - LOGIN_WINDOW_MS` count. Reaching LOGIN_MAX_FAILURES locks the IP and
 * clears the counter so the lock is a single 15-minute period.
 */
export function recordLoginFailure(store: LoginRateLimitStore, ip: string, now: number): void {
  const state = store.get(ip) ?? { failures: [], lockedUntil: null }
  const cutoff = now - LOGIN_WINDOW_MS
  state.failures = state.failures.filter((at) => at > cutoff)
  state.failures.push(now)
  if (state.failures.length >= LOGIN_MAX_FAILURES) {
    state.lockedUntil = now + LOGIN_LOCK_MS
    state.failures = []
  }
  store.set(ip, state)
}

/** A successful sign-in wipes the IP's failure history and any stale lock. */
export function recordLoginSuccess(store: LoginRateLimitStore, ip: string): void {
  store.delete(ip)
}

/**
 * Drops entries whose failures all fell out of the window and whose lock has
 * expired, so the Map cannot grow with one entry per bot IP forever.
 */
export function sweepLoginRateLimit(store: LoginRateLimitStore, now: number): void {
  const cutoff = now - LOGIN_WINDOW_MS
  for (const [ip, state] of store) {
    const failures = state.failures.filter((at) => at > cutoff)
    if (state.lockedUntil != null && state.lockedUntil <= now) state.lockedUntil = null
    if (!failures.length && state.lockedUntil == null) store.delete(ip)
    else if (failures.length !== state.failures.length) state.failures = failures
  }
}

/**
 * Starts the periodic sweeper for a live store. Returns a stop function.
 * The timer is unref'd so it never keeps the process alive on its own.
 */
export function startLoginRateLimitSweeper(
  store: LoginRateLimitStore,
  intervalMs = 60_000,
  now: () => number = () => Date.now(),
): () => void {
  const timer = setInterval(() => sweepLoginRateLimit(store, now()), intervalMs)
  timer.unref?.()
  return () => clearInterval(timer)
}
