<template>
  <span
    class="inline-flex items-center gap-1.5 tabular-nums"
    :class="bandClass(shownBand)"
    :title="title"
    :data-metric="metricKey"
    :data-band="shownBand ?? undefined"
    :data-scope="rank?.scope ?? undefined"
  >
    <span v-if="showDot" class="size-1.5 shrink-0 rounded-full" :class="bandDot(shownBand)" aria-hidden="true" />
    {{ format(metricKey, value, compact) }}
  </span>
</template>

<script setup lang="ts">
import type { MetricPercentile, NumericMetricKey, PercentileBand, PercentileCohort } from '@kcs/contract'

/** 单个指标值：按单位格式化，并用分位色带标出在同类博主里的位置；提示里写明和谁比。 */
const props = withDefaults(
  defineProps<{
    metricKey: NumericMetricKey
    value: number | null | undefined
    /** 完整排位（带人数、粉丝范围、平台/本库）；只有色带时用 band。 */
    rank?: MetricPercentile | null
    band?: PercentileBand | null
    percentile?: number | null
    cohort?: PercentileCohort | null
    stale?: boolean
    compact?: boolean
    dot?: boolean
  }>(),
  { rank: null, band: null, percentile: null, cohort: null, stale: false, compact: false, dot: true },
)

const { t } = useI18n()
const { format, bandClass, bandDot, bandLabel, help, rankText } = useMetrics()

const shownBand = computed(() => props.rank?.band ?? props.band)

/** 只给极端分位点亮：前 25% 与后 25%，中段不加噪。 */
const showDot = computed(() => props.dot && (shownBand.value === 'top10' || shownBand.value === 'top25' || shownBand.value === 'bottom'))

const title = computed(() => {
  const parts = [help(props.metricKey)]
  if (props.stale) parts.push(t('kcs.band.stale'))
  else if (shownBand.value) {
    parts.push(bandLabel(shownBand.value))
    parts.push(...rankText(props.rank, props.cohort))
  }
  return parts.filter(Boolean).join('\n')
})
</script>
