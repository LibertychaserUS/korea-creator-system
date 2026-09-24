import { describe, expect, it } from 'vitest'
import {
  detectChange,
  dayNumber,
  dayString,
  fastestGrowing,
  forecastCapacity,
  holt,
  theilSen,
  withoutJumps,
} from '../src/ops/capacity/forecast'

const GB = 1024 ** 3
const START = dayNumber('2026-08-01')

/** Deterministic noise: mulberry32 + Box–Muller. */
function rng(seed: number) {
  let a = seed >>> 0
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return () => Math.sqrt(-2 * Math.log(uniform() || 1e-12)) * Math.cos(2 * Math.PI * uniform())
}

type Row = { day: string; used: number; capacity: number }

function series(days: number, used: (i: number) => number, capacity = 100 * GB): Row[] {
  return Array.from({ length: days }, (_, i) => ({ day: dayString(START + i), used: used(i), capacity }))
}

const points = (rows: Row[]) => rows.map((r) => ({ t: dayNumber(r.day), y: r.used }))

describe('Theil–Sen slope and interval', () => {
  it('a clean line: the slope exactly, a zero-width interval', () => {
    const ts = theilSen(points(series(28, (i) => 40 * GB + i * GB)))!
    expect(ts.slope).toBeCloseTo(GB, 0)
    expect(ts.lower).toBeCloseTo(GB, 0)
    expect(ts.upper).toBeCloseTo(GB, 0)
  })

  it('a noisy line: slope within 5%, the interval brackets it', () => {
    const noise = rng(7)
    const ts = theilSen(points(series(28, (i) => 40 * GB + i * GB + noise() * 0.3 * GB)))!
    expect(Math.abs(ts.slope - GB) / GB).toBeLessThan(0.05)
    expect(ts.lower).toBeLessThan(ts.slope)
    expect(ts.upper).toBeGreaterThan(ts.slope)
    expect(ts.lower).toBeLessThan(GB)
    expect(ts.upper).toBeGreaterThan(GB)
  })

  it('the 90% interval covers the true slope about 90% of the time', () => {
    let covered = 0
    const trials = 400
    for (let seed = 1; seed <= trials; seed++) {
      const noise = rng(seed)
      const ts = theilSen(points(series(28, (i) => 40 * GB + i * GB + noise() * 1.5 * GB)))!
      if (ts.lower <= GB && GB <= ts.upper) covered++
    }
    const rate = covered / trials
    expect(rate).toBeGreaterThan(0.84)
    expect(rate).toBeLessThan(0.97)
  })

  it('a flat series has slope 0 and a zero-width interval (ties handled)', () => {
    const ts = theilSen(points(series(20, () => 55 * GB)))!
    expect(ts).toMatchObject({ slope: 0, lower: 0, upper: 0 })
  })
})

describe('Holt linear smoothing', () => {
  it('tracks a line: trend ≈ slope, level ≈ last value', () => {
    const values = Array.from({ length: 20 }, (_, i) => 10 * GB + 2 * GB * i)
    const h = holt(values)!
    expect(h.trend / GB).toBeCloseTo(2, 3)
    expect(h.level / GB).toBeCloseTo(48, 3)
  })
})

describe('change in growth speed (CUSUM)', () => {
  it('finds the day growth sped up, and nothing on a steady line', () => {
    const noise = rng(11)
    const rows = series(28, (i) => 30 * GB + (i < 18 ? i * 0.5 * GB : 9 * GB + (i - 18) * 3 * GB) + noise() * 0.05 * GB)
    const change = detectChange(points(rows))!
    expect(change).not.toBeNull()
    expect(Math.abs(change.t - (START + 18))).toBeLessThanOrEqual(1)
    expect(change.before / GB).toBeCloseTo(0.5, 0)
    expect(change.after / GB).toBeCloseTo(3, 0)

    const steady = series(28, (i) => 30 * GB + i * GB + noise() * 0.2 * GB)
    expect(detectChange(points(steady))).toBeNull()
  })

  it('a single bulk import is a jump, not a new speed', () => {
    const rows = series(28, (i) => 30 * GB + i * GB + (i >= 15 ? 12 * GB : 0))
    expect(detectChange(points(rows))).toBeNull()
    const cleaned = withoutJumps(points(rows))
    expect(cleaned.at(-1)!.y).toBeCloseTo(30 * GB + 27 * GB, -3)
  })

  it('false alarms on noisy steady lines stay rare', () => {
    let alarms = 0
    for (let seed = 100; seed < 300; seed++) {
      const noise = rng(seed)
      if (detectChange(points(series(28, (i) => 30 * GB + i * GB + noise() * 0.4 * GB)))) alarms++
    }
    expect(alarms / 200).toBeLessThan(0.08)
  })
})

describe('forecastCapacity on synthetic disks (100 GB)', () => {
  it('linear growth: days to 70% / 90% from the upper slope, an early-leaning estimate', () => {
    const noise = rng(3)
    const rows = series(35, (i) => 20 * GB + i * GB + noise() * 0.2 * GB)
    const f = forecastCapacity({ series: rows })
    expect(f.status).toBe('ok')
    expect(f.points).toBe(28)
    expect(f.window).toEqual({ from: rows[7]!.day, to: rows[34]!.day })
    expect(f.slope!.perDay / GB).toBeCloseTo(1, 1)
    const [to70, to90] = f.etas
    const last = rows.at(-1)!.used
    expect(to70!.days).toBeCloseTo((70 * GB - last) / f.slope!.upper, 6)
    expect(to70!.days!).toBeLessThanOrEqual(to70!.daysLikely!)
    expect(to70!.daysLikely! / ((70 * GB - last) / GB)).toBeCloseTo(1, 1)
    expect(to90!.days!).toBeGreaterThan(to70!.days!)
    // ~54% used, ~16 days to 70% → warning because of "70% within 30 days".
    expect(f.level).toBe('warning')
    expect(f.reasons).toContainEqual(expect.objectContaining({ kind: 'eta', threshold: 0.7, within: 30 }))
    expect(f.next7).toHaveLength(7)
    expect(f.next7[0]!.used).toBeGreaterThanOrEqual(last + f.slope!.perDay * 0.99)
  })

  it('a jump: slope stays the underlying speed, the forecast starts from the new level', () => {
    const rows = series(28, (i) => 20 * GB + 0.5 * GB * i + (i >= 20 ? 15 * GB : 0))
    const f = forecastCapacity({ series: rows })
    expect(f.changePoint).toBeNull()
    expect(f.jumps).toEqual([rows[20]!.day])
    expect(f.slope).toMatchObject({ perDay: 0.5 * GB, lower: 0.5 * GB, upper: 0.5 * GB })
    const last = rows.at(-1)!.used
    expect(f.etas[0]!.daysLikely).toBeCloseTo((70 * GB - last) / (0.5 * GB), 0)
    // Holt does not mistake the restore for fast growth.
    expect(f.holt!.trendPerDay / GB).toBeCloseTo(0.5, 1)
    expect(f.level).toBe('ok')
  })

  it('a jump inside noise is still a jump; the interval stays tight', () => {
    const noise = rng(21)
    const rows = series(28, (i) => 20 * GB + 0.5 * GB * i + (i >= 12 ? 10 * GB : 0) + noise() * 0.05 * GB)
    const f = forecastCapacity({ series: rows })
    expect(f.jumps).toEqual([rows[12]!.day])
    expect(f.changePoint).toBeNull()
    expect(f.slope!.perDay / GB).toBeCloseTo(0.5, 1)
    expect((f.slope!.upper - f.slope!.lower) / GB).toBeLessThan(0.05)
  })

  it('a change point: only the new speed is used, and it is flagged', () => {
    const rows = series(28, (i) => 30 * GB + (i < 16 ? 0.2 * GB * i : 3.2 * GB + 2 * GB * (i - 16)))
    const f = forecastCapacity({ series: rows })
    expect(f.changePoint!.day).toBe(rows[16]!.day)
    expect(f.slope!.perDay / GB).toBeCloseTo(2, 1)
    // 55.2 GB now, 2 GB/day → 70% in ~7.4 days (warning); 90% in ~17 days.
    expect(f.etas[0]!.days!).toBeCloseTo((70 - 55.2) / 2, 0)
    expect(f.etas[1]!.days!).toBeCloseTo((90 - 55.2) / 2, 0)
    expect(f.level).toBe('warning')
    expect(f.reasons.map((r) => r.kind)).toEqual(expect.arrayContaining(['eta', 'change']))
  })

  it('a plateau: never reaches 70% on this trend, no alert', () => {
    const f = forecastCapacity({ series: series(28, () => 40 * GB) })
    expect(f.slope).toMatchObject({ perDay: 0, lower: 0, upper: 0 })
    expect(f.etas.map((e) => e.days)).toEqual([null, null])
    expect(f.level).toBe('ok')

    const noise = rng(5)
    const wobbly = forecastCapacity({ series: series(28, () => 40 * GB + noise() * 0.05 * GB) })
    expect(Math.abs(wobbly.slope!.perDay)).toBeLessThan(0.02 * GB)
    expect(wobbly.level).toBe('ok')
  })

  it('under 7 days of readings: the current value only', () => {
    const f = forecastCapacity({ series: series(6, (i) => 50 * GB + i * GB) })
    expect(f.status).toBe('insufficient')
    expect(f.used).toBe(55 * GB)
    expect(f.usage).toBeCloseTo(0.55)
    expect(f.slope).toBeNull()
    expect(f.etas).toEqual([])
    expect(forecastCapacity({ series: [] }).status).toBe('empty')
  })

  it('usage alone: over 70% warns, over 90% is critical', () => {
    expect(forecastCapacity({ series: series(3, () => 75 * GB) }).level).toBe('warning')
    const critical = forecastCapacity({ series: series(3, () => 92 * GB) })
    expect(critical.level).toBe('critical')
    expect(critical.reasons.filter((r) => r.kind === 'usage').map((r) => r.threshold)).toEqual([0.7, 0.9])
  })

  it('90% within 7 days is critical', () => {
    const f = forecastCapacity({ series: series(14, (i) => 70 * GB + 1.2 * GB * i) })
    expect(f.etas[1]!.days!).toBeLessThanOrEqual(7)
    expect(f.level).toBe('critical')
  })

  it('70% more than 30 days out stays quiet', () => {
    const f = forecastCapacity({ series: series(28, (i) => 20 * GB + 0.3 * GB * i) })
    expect(f.etas[0]!.days!).toBeGreaterThan(30)
    expect(f.level).toBe('ok')
  })

  it('worst case: every source spending its whole quota', () => {
    const f = forecastCapacity({ series: series(10, (i) => 50 * GB + 0.1 * GB * i), worstCasePerDay: 2 * GB })
    expect(f.worstCasePerDay).toBe(2 * GB)
    expect(f.etas[0]!.daysWorstCase).toBeCloseTo((70 - 50.9) / 2, 5)
  })

  it('without a known disk size it still reports growth', () => {
    const rows = series(10, (i) => 5 * GB + i * GB).map((r) => ({ ...r, capacity: 0 }))
    const f = forecastCapacity({ series: rows })
    expect(f.status).toBe('no_capacity')
    expect(f.slope!.perDay / GB).toBeCloseTo(1, 5)
    expect(f.etas).toEqual([])
  })
})

describe('fastestGrowing', () => {
  it('the three tables growing fastest, flat or shrinking ones left out', () => {
    const mk = (perDay: number, start = GB) =>
      Array.from({ length: 10 }, (_, i) => ({ day: dayString(START + i), bytes: start + perDay * i }))
    const top = fastestGrowing(new Map([
      ['creator_raw', mk(300e6)],
      ['creators', mk(5e6)],
      ['audit_logs', mk(1e6)],
      ['ingest_jobs', mk(20e6)],
      ['assets', mk(0)],
      ['sessions', mk(-2e6)],
    ]))
    expect(top.map((t) => t.name)).toEqual(['creator_raw', 'ingest_jobs', 'creators'])
    expect(top[0]!.perDay).toBeCloseTo(300e6, -2)
  })
})
