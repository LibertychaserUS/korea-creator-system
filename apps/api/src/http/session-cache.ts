/**
 * Token → identity cache with a hard size cap. A Map keeps insertion order, so
 * re-inserting on read makes the first key the least recently used one; past
 * `max` the oldest entry goes. Expired entries also leave on `sweep()`, which
 * the owner runs on a timer so idle tokens do not sit in memory until evicted.
 */
export class SessionCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>()

  constructor(readonly max: number) {}

  get size() {
    return this.entries.size
  }

  get(key: string, now: number): { value: V } | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    this.entries.delete(key)
    if (entry.expiresAt <= now) return undefined
    this.entries.set(key, entry)
    return { value: entry.value }
  }

  set(key: string, value: V, expiresAt: number) {
    this.entries.delete(key)
    this.entries.set(key, { value, expiresAt })
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value as string
      this.entries.delete(oldest)
    }
  }

  sweep(now: number) {
    let removed = 0
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key)
        removed += 1
      }
    }
    return removed
  }
}
