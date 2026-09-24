<template>
  <div class="flex items-start gap-3" :data-metric="metricKey">
    <svg v-if="drawable" class="mt-1 h-8 w-24 shrink-0 overflow-visible" viewBox="0 0 96 32" aria-hidden="true">
      <path v-if="lines.length === 1" :d="lines[0]!.area" class="fill-primary/10" />
      <template v-for="l in lines" :key="l.source">
        <path v-if="l.points.length > 1" :d="l.path" class="fill-none" :class="l.stroke" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
        <circle :cx="l.points.at(-1)!.x" :cy="l.points.at(-1)!.y" r="2.5" :class="l.fill" />
      </template>
    </svg>
    <span v-else class="mt-1 h-8 w-24 shrink-0 rounded-sm border border-dashed border-border/60" aria-hidden="true" />
    <div class="min-w-0 leading-tight">
      <p class="truncate text-xs text-muted-foreground">{{ label(metricKey) }}</p>
      <p class="flex items-baseline gap-2">
        <span class="text-sm font-semibold tabular-nums">{{ format(metricKey, main?.latest ?? null) }}</span>
        <span v-if="main && main.delta != null" class="text-[11px] tabular-nums" :class="deltaClass(main.delta)">{{ deltaText(main.delta) }}</span>
      </p>
      <ul v-if="lines.length > 1" class="mt-1 space-y-0.5" :aria-label="t('kcs.display.trendBySource')">
        <li v-for="l in lines" :key="l.source" class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span class="size-1.5 shrink-0 rounded-full" :class="l.fill" aria-hidden="true" />
          <span class="truncate">{{ t(`kcs.source.${l.source}`) }}</span>
          <span class="tabular-nums text-foreground">{{ format(metricKey, l.latest) }}</span>
          <span v-if="l.delta != null" class="tabular-nums" :class="deltaClass(l.delta)">{{ deltaText(l.delta) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { metricField, type NumericMetricKey, type TrendSeries } from '@kcs/contract'

/**
 * 一个指标在历史快照上的走势：每个来源一条线（接口按来源分好，口径不同不能连成一条），
 * 同一纵轴、按抓取时间排开；最新值取最近一次抓到的来源，涨跌只在同一来源内算。
 * 空值跳过。
 */
const props = defineProps<{
  metricKey: NumericMetricKey
  series: TrendSeries[]
}>()

const { t, locale } = useI18n()
const { format, label } = useMetrics()

const COLORS = [
  { stroke: 'stroke-primary', fill: 'fill-primary bg-primary' },
  { stroke: 'stroke-amber-500', fill: 'fill-amber-500 bg-amber-500' },
  { stroke: 'stroke-sky-500', fill: 'fill-sky-500 bg-sky-500' },
  { stroke: 'stroke-emerald-500', fill: 'fill-emerald-500 bg-emerald-500' },
]

type Point = { at: number; value: number }

const bySource = computed(() =>
  props.series
    .map((line) => {
      const points: Point[] = []
      for (const s of line.snapshots) {
        const value = s.metrics[props.metricKey]
        const at = Date.parse(s.fetchedAt)
        if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(at)) continue
        points.push({ at, value })
      }
      points.sort((a, b) => a.at - b.at)
      return [line.source, points] as [string, Point[]]
    })
    .filter(([, points]) => points.length > 0),
)

function change(points: Point[]): number | null {
  if (points.length < 2) return null
  const first = points[0]!.value
  if (first === 0) return null
  return (points.at(-1)!.value - first) / Math.abs(first)
}

const lines = computed(() => {
  const all = bySource.value.flatMap(([, list]) => list)
  if (!all.length) return []
  const t0 = Math.min(...all.map((p) => p.at))
  const t1 = Math.max(...all.map((p) => p.at))
  const min = Math.min(...all.map((p) => p.value))
  const max = Math.max(...all.map((p) => p.value))
  const tSpan = t1 - t0 || 1
  const vSpan = max - min || 1
  return bySource.value.map(([source, list], i) => {
    const points = list.map((p) => ({
      x: t1 === t0 ? 94 : ((p.at - t0) / tSpan) * 92 + 2,
      y: max === min ? 16 : 28 - ((p.value - min) / vSpan) * 24,
    }))
    const path = points.map((p, j) => `${j ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const area = points.length > 1 ? `${path} L${points.at(-1)!.x.toFixed(1)} 32 L${points[0]!.x.toFixed(1)} 32 Z` : ''
    return {
      source,
      points,
      path,
      area,
      latest: list.at(-1)!.value,
      latestAt: list.at(-1)!.at,
      delta: change(list),
      ...COLORS[i % COLORS.length]!,
    }
  })
})

const drawable = computed(() => lines.value.some((l) => l.points.length > 1) || lines.value.length > 1)
const main = computed(() => [...lines.value].sort((a, b) => b.latestAt - a.latestAt)[0] ?? null)

/** `better: 'low'` 指标（CPE/CPM）下降才是好事；只描述不排位的指标不分好坏。 */
function deltaClass(delta: number): string {
  const better = metricField(props.metricKey).better
  if (Math.abs(delta) < 0.005 || better === null) return 'text-muted-foreground'
  const good = better === 'low' ? delta < 0 : delta > 0
  return good ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
}

function deltaText(delta: number): string {
  const sign = delta > 0 ? '+' : ''
  return sign + new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(delta)
}
</script>
