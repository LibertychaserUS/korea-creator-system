<template>
  <span
    class="inline-flex items-center gap-1.5 tabular-nums"
    :class="bandClass(band)"
    :title="title"
    :data-metric="metricKey"
    :data-band="band ?? undefined"
  >
    <span v-if="showDot" class="size-1.5 shrink-0 rounded-full" :class="bandDot(band)" aria-hidden="true" />
    {{ format(metricKey, value, compact) }}
  </span>
</template>

<script setup lang="ts">
import type { NumericMetricKey, PercentileBand } from '@kcs/contract'

/** 单个指标值：按单位格式化，并用分位色带标出同量级位置。 */
const props = withDefaults(
  defineProps<{
    metricKey: NumericMetricKey
    value: number | null | undefined
    band?: PercentileBand | null
    percentile?: number | null
    compact?: boolean
    dot?: boolean
  }>(),
  { band: null, percentile: null, compact: false, dot: true },
)

const { format, bandClass, bandDot, bandLabel, help } = useMetrics()

/** 只给极端分位点亮：前 25% 与后 25%，中段不加噪。 */
const showDot = computed(() => props.dot && (props.band === 'top10' || props.band === 'top25' || props.band === 'bottom'))

const title = computed(() => {
  const parts = [help(props.metricKey)]
  if (props.band) parts.push(props.percentile != null ? `${bandLabel(props.band)} · P${Math.round(props.percentile)}` : bandLabel(props.band))
  return parts.filter(Boolean).join('\n')
})
</script>
