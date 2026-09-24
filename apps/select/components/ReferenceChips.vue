<template>
  <p v-if="line" class="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground" data-testid="reference-chips">
    <span>{{ t('kcs.query.reference', { source: line.source ? t(`kcs.source.${line.source}`) : '', tier: t(`kcs.tier.${line.tier}`), n: line.n }) }}</span>
    <button
      v-for="point in points"
      :key="point.label"
      type="button"
      class="h-6 rounded border border-border bg-background px-1.5 tabular-nums text-foreground hover:bg-muted"
      :title="t('kcs.query.referenceHint')"
      :data-testid="`reference-${point.id}`"
      @click="emit('pick', point.value)"
    >
      {{ point.label }} {{ format(metricKey, point.value) }}
    </button>
  </p>
  <p v-else class="text-[11px] text-muted-foreground/70" data-testid="reference-none">{{ t('kcs.query.referenceNone') }}</p>
</template>

<script lang="ts">
export type ReferenceLine = {
  group: string
  source: string | null
  window: number
  contentForm: string | null
  tier: string
  key: string
  n: number
  p25: number
  p50: number
  p75: number
}
</script>

<script setup lang="ts">
import type { NumericMetricKey } from '@kcs/contract'

/** 本库同组的 25% / 中位 / 75% 数值，点一下填进条件。组内不足 30 人时不给。 */
const props = defineProps<{ line: ReferenceLine | null; metricKey: NumericMetricKey }>()
const emit = defineEmits<{ pick: [value: number] }>()

const { t } = useI18n()
const { format } = useMetrics()

/** 填入的值与显示一致：比率保留 4 位小数，其余 2 位。 */
function rounded(value: number) {
  return Number(value.toFixed(Math.abs(value) < 1 ? 4 : 2))
}

const points = computed(() =>
  props.line
    ? [
        { id: 'p25', label: t('kcs.query.refP25'), value: rounded(props.line.p25) },
        { id: 'p50', label: t('kcs.query.refP50'), value: rounded(props.line.p50) },
        { id: 'p75', label: t('kcs.query.refP75'), value: rounded(props.line.p75) },
      ]
    : [],
)
</script>
