import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLoginRateLimitStore,
  isLoginLocked,
  LOGIN_LOCK_MS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  recordLoginFailure,
  recordLoginSuccess,
  startLoginRateLimitSweeper,
  sweepLoginRateLimit,
} from '../../libs/panel/server/utils/login-rate-limit'
import { isSameOrigin } from '../../libs/panel/server/utils/same-origin'

/**
 * H-1 login brute-force limiter. The store and `now` are injected, so the
 * window/lock/sweep rules are tested without any Nuxt runtime.
 */
describe('login rate limit (H-1)', () => {
  const t0 = 1_000_000_000_000
  let store: ReturnType<typeof createLoginRateLimitStore>
  let now: number

  beforeEach(() => {
    store = createLoginRateLimitStore()
    now = t0
  })

  function fail(ip: string, times = 1) {
    for (let i = 0; i < times; i++) recordLoginFailure(store, ip, now)
  }

  it('allows attempts until the failure threshold is reached', () => {
    fail('10.0.0.1', LOGIN_MAX_FAILURES - 1)
    expect(isLoginLocked(store, '10.0.0.1', now)).toBe(false)
    recordLoginFailure(store, '10.0.0.1', now)
    expect(isLoginLocked(store, '10.0.0.1', now)).toBe(true)
  })

  it('keeps the IP locked for 15 minutes and frees it afterwards', () => {
    fail('10.0.0.1', LOGIN_MAX_FAILURES)
    const lockedAt = now
    expect(isLoginLocked(store, '10.0.0.1', lockedAt + LOGIN_LOCK_MS - 1)).toBe(true)
    expect(isLoginLocked(store, '10.0.0.1', lockedAt + LOGIN_LOCK_MS)).toBe(false)
  })

  it('uses a rolling 10-minute window: old failures do not count', () => {
    // Scenario 1: failures spread out over the window still accumulate — the
    // 5th attempt, well before the first one has aged out, trips the lock.
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) {
      recordLoginFailure(store, '10.0.0.1', now)
      now += 1_000
    }
    now = t0 + LOGIN_WINDOW_MS - 1_000
    recordLoginFailure(store, '10.0.0.1', now)
    // All 4 earlier failures are still inside the window → the 5th trips the
    // lock (which also resets the failure list).
    expect(isLoginLocked(store, '10.0.0.1', now)).toBe(true)
    expect(store.get('10.0.0.1')?.failures).toHaveLength(0)

    // Scenario 2: a fresh IP whose failures all fell out of the window starts
    // from a clean slate — one new failure is just one.
    recordLoginSuccess(store, '10.0.0.2')
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) recordLoginFailure(store, '10.0.0.2', now)
    now += LOGIN_WINDOW_MS + 1_000
    recordLoginFailure(store, '10.0.0.2', now)
    expect(store.get('10.0.0.2')?.failures).toHaveLength(1)
    expect(isLoginLocked(store, '10.0.0.2', now)).toBe(false)
  })

  it('counts IPs independently', () => {
    fail('10.0.0.1', LOGIN_MAX_FAILURES)
    fail('10.0.0.2', 1)
    expect(isLoginLocked(store, '10.0.0.1', now)).toBe(true)
    expect(isLoginLocked(store, '10.0.0.2', now)).toBe(false)
  })

  it('resets the history after a successful sign-in', () => {
    fail('10.0.0.1', LOGIN_MAX_FAILURES - 1)
    recordLoginSuccess(store, '10.0.0.1')
    fail('10.0.0.1', LOGIN_MAX_FAILURES - 1)
    expect(isLoginLocked(store, '10.0.0.1', now)).toBe(false)
  })

  it('clears an expired lock lazily on the next check', () => {
    fail('10.0.0.1', LOGIN_MAX_FAILURES)
    expect(isLoginLocked(store, '10.0.0.1', now)).toBe(true)
    now += LOGIN_LOCK_MS + 1
    expect(isLoginLocked(store, '10.0.0.1', now)).toBe(false)
    expect(store.get('10.0.0.1')?.lockedUntil).toBeNull()
  })

  it('sweep removes expired entries but keeps active locks', () => {
    fail('10.0.0.1', LOGIN_MAX_FAILURES) // locked
    fail('10.0.0.2', 2) // a couple of stale failures, no lock
    now += LOGIN_WINDOW_MS + 1
    sweepLoginRateLimit(store, now)
    expect(store.has('10.0.0.2')).toBe(false)
    expect(store.has('10.0.0.1')).toBe(true)
    // Still locked until the lock itself expires.
    expect(isLoginLocked(store, '10.0.0.1', now)).toBe(true)
    now += LOGIN_LOCK_MS + 1
    sweepLoginRateLimit(store, now)
    expect(store.has('10.0.0.1')).toBe(false)
    expect(store.size).toBe(0)
  })

  it('sweeper runs on its interval and stops when told to', () => {
    vi.useFakeTimers()
    try {
      fail('10.0.0.2', 1)
      const stop = startLoginRateLimitSweeper(store, 60_000, () => now)
      now += LOGIN_WINDOW_MS + 1
      vi.advanceTimersByTime(120_000)
      expect(store.size).toBe(0)
      stop()
      recordLoginFailure(store, '10.0.0.3', now)
      vi.advanceTimersByTime(120_000)
      expect(store.has('10.0.0.3')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

/**
 * M-1 same-origin helper core (the h3 wrapper stays in Nitro; the pure
 * comparison is what carries the security rule).
 */
describe('same-origin check (M-1)', () => {
  it('accepts matching http(s) origins with the same host and port', () => {
    expect(isSameOrigin('https://app.example.com', 'app.example.com')).toBe(true)
    expect(isSameOrigin('http://localhost:7002', 'localhost:7002')).toBe(true)
  })

  it('rejects a different host, port or scheme', () => {
    expect(isSameOrigin('https://evil.example.com', 'app.example.com')).toBe(false)
    expect(isSameOrigin('https://app.example.com.evil.com', 'app.example.com')).toBe(false)
    expect(isSameOrigin('http://localhost:7003', 'localhost:7002')).toBe(false)
    expect(isSameOrigin('javascript:alert(1)', 'app.example.com')).toBe(false)
    expect(isSameOrigin('null', 'app.example.com')).toBe(false)
  })

  it('treats unparseable values as pass-through (headers browsers never send)', () => {
    expect(isSameOrigin('not a url', 'app.example.com')).toBe(true)
  })
})
