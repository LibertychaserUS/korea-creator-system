<template>
  <div class="flex items-center gap-3" :data-metric="metricKey">
    <svg v-if="points.length > 1" class="h-8 w-24 shrink-0 overflow-visible" viewBox="0 0 96 32" aria-hidden="true">
      <path :d="area" class="fill-primary/10" />
      <path :d="line" class="fill-none stroke-primary" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
      <circle :cx="last.x" :cy="last.y" r="2.5" class="fill-primary" />
    </svg>
    <span v-else class="h-8 w-24 shrink-0 rounded-sm border border-dashed border-border/60" aria-hidden="true" />
    <div class="min-w-0 leading-tight">
      <p class="truncate text-xs text-muted-foreground">{{ label(metricKey) }}</p>
      <p class="flex items-baseline gap-2">
        <span class="text-sm font-semibold tabular-nums">{{ format(metricKey, latest) }}</span>
        <span v-if="delta != null" class="text-[11px] tabular-nums" :class="deltaClass">{{ deltaText }}</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { metricField, type MetricSnapshot, type NumericMetricKey } from '@kcs/contract'

/**
 * 一个指标在历史快照上的走势：迷你折线 + 最新值 + 首末变化。
 * 快照按 fetchedAt 升序传入；空值跳过，少于两点只显示最新值。
 */
const props = defineProps<{
  metricKey: NumericMetricKey
  snapshots: MetricSnapshot[]
}>()

const { locale } = useI18n()
const { format, label } = useMetrics()

const series = computed(() =>
  props.snapshots
    .map((s) => s.metrics[props.metricKey])
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v)),
)

const latest = computed(() => series.value.at(-1) ?? null)
const delta = computed(() => {
  if (series.value.length < 2) return null
  const first = series.value[0]!
  const lastValue = series.value.at(-1)!
  if (first === 0) return null
  return (lastValue - first) / Math.abs(first)
})

/** `better: 'low'` 指标（CPE/CPM）下降才是好事。 */
const deltaClass = computed(() => {
  if (delta.value == null || Math.abs(delta.value) < 0.005) return 'text-muted-foreground'
  const better = metricField(props.metricKey).better
  const good = better === 'low' ? delta.value < 0 : delta.value > 0
  return good ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
})
const deltaText = computed(() => {
  if (delta.value == null) return ''
  const sign = delta.value > 0 ? '+' : ''
  return sign + new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(delta.value)
})

const points = computed(() => {
  const values = series.value
  if (values.length < 2) return [] as { x: number; y: number }[]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values.map((v, i) => ({
    x: (i / (values.length - 1)) * 92 + 2,
    y: 28 - ((v - min) / span) * 24,
  }))
})
const line = computed(() => points.value.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '))
const area = computed(() => (points.value.length ? `${line.value} L${points.value.at(-1)!.x.toFixed(1)} 32 L${points.value[0]!.x.toFixed(1)} 32 Z` : ''))
const last = computed(() => points.value.at(-1) ?? { x: 0, y: 0 })
</script>
