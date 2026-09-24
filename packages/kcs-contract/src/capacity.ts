/**
 * Storage monitoring and forecast (运维端「存储」). Readings are taken once a
 * day; the forecast is recomputed from the stored readings.
 */

export type CapacityLevel = 'ok' | 'notice' | 'warning' | 'critical'

export type ThresholdEta = {
  threshold: number
  /** Days from the last reading, conservative (upper slope, or Holt when sooner within 7 days). `0` = already there, `null` = not on the current trend. */
  days: number | null
  /** Days at the central slope estimate. */
  daysLikely: number | null
  /** Days if every source used its full daily quota every day. */
  daysWorstCase: number | null
}

export type CapacityReason =
  | { kind: 'usage'; threshold: number; usage: number }
  | { kind: 'eta'; threshold: number; days: number; within: number }
  | { kind: 'change'; day: string; beforePerDay: number; afterPerDay: number }

export type CapacityForecast = {
  status: 'ok' | 'insufficient' | 'no_capacity' | 'empty'
  lastDay: string | null
  used: number | null
  capacity: number | null
  usage: number | null
  points: number
  window: { from: string; to: string } | null
  /** Bytes per day, from the readings used for the fit. */
  slope: { perDay: number; lower: number; upper: number } | null
  holt: { level: number; trendPerDay: number; alpha: number; beta: number } | null
  /** Next seven days, the larger of Holt and Theil–Sen each day. */
  next7: { day: string; used: number }[]
  changePoint: { day: string; beforePerDay: number; afterPerDay: number } | null
  jumps: string[]
  worstCasePerDay: number | null
  etas: ThresholdEta[]
  level: CapacityLevel
  reasons: CapacityReason[]
}

export type CapacityTableReading = {
  name: string
  totalBytes: number
  tableBytes: number
  indexBytes: number
  toastBytes: number
  liveTuples: number
  deadTuples: number
}

export type CapacityDiskReading = { name: string; size: number; used: number; avail: number; declared: boolean }

export type CapacitySourceReading = {
  id: string
  records: number
  calls: number
  avgRawBytes: number | null
}

export type CapacityWorstCase = {
  perDay: number | null
  indexOverhead: number | null
  sources: {
    id: string
    quota: number | null
    recordsPerCall: number | null
    avgRawBytes: number | null
    perDay: number | null
  }[]
}

export type CapacityReport = {
  generatedAt: string
  lastReadingAt: string | null
  latest: {
    day: string
    databaseBytes: number | null
    walBytes: number | null
    disk: CapacityDiskReading | null
    backup: { name: string; bytes: number; disk: CapacityDiskReading | null } | null
    tables: CapacityTableReading[]
    sources: CapacitySourceReading[]
  } | null
  forecast: CapacityForecast
  /** Database size alone, when the disk is shared with other things. */
  database: { perDay: number | null; lower: number | null; upper: number | null }
  topGrowing: { name: string; perDay: number; bytes: number }[]
  worstCase: CapacityWorstCase
  history: { day: string; used: number | null; capacity: number | null; databaseBytes: number | null }[]
}
