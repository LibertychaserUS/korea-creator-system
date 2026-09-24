<template>
  <div class="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1.5" :data-testid="testid">
    <select v-model="filter.key" class="border-input h-8 min-w-0 rounded-md border bg-background px-2 text-xs shadow-xs outline-none" :aria-label="t('kcs.query.metricPick')">
      <option v-for="key in VISIBLE_METRIC_KEYS" :key="key" :value="key">{{ label(key) }}</option>
    </select>
    <select v-model="filter.op" class="border-input h-8 rounded-md border bg-background px-2 text-xs shadow-xs outline-none" :aria-label="t('kcs.query.opPick')" @change="onOpChange">
      <option value="gte">{{ t('kcs.query.op.gte') }}</option>
      <option value="lte">{{ t('kcs.query.op.lte') }}</option>
      <option value="between">{{ t('kcs.query.op.between') }}</option>
      <option value="percentileGte">{{ t('kcs.query.op.percentileGte') }}</option>
    </select>
    <div v-if="filter.op === 'between'" class="flex min-w-0 items-center gap-1">
      <Input v-model.number="(filter.value as [number, number])[0]" type="number" step="any" class="h-8 min-w-0 px-2 text-xs tabular-nums" :aria-label="t('kcs.query.from')" />
      <span class="text-muted-foreground/60">–</span>
      <Input v-model.number="(filter.value as [number, number])[1]" type="number" step="any" class="h-8 min-w-0 px-2 text-xs tabular-nums" :aria-label="t('kcs.query.to')" />
    </div>
    <Input
      v-else
      v-model.number="filter.value"
      type="number"
      step="any"
      class="h-8 min-w-0 px-2 text-xs tabular-nums"
      :aria-label="t('kcs.query.value')"
      :placeholder="filter.op === 'percentileGte' ? '75' : unitHint(filter.key)"
    />
    <Button variant="ghost" size="icon" class="size-8 text-muted-foreground" :aria-label="`${t('kcs.query.removeFilter')} · ${label(filter.key)}`" @click="emit('remove')">
      <X class="size-3.5" />
    </Button>
    <ReferenceChips v-if="filter.op === 'gte' || filter.op === 'lte'" class="col-span-full" :line="reference" :metric-key="filter.key" @pick="(v) => (filter.value = v)" />
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { VISIBLE_METRIC_KEYS, metricField, type MetricFilter, type NumericMetricKey } from '@kcs/contract'
import ReferenceChips, { type ReferenceLine } from '~/components/ReferenceChips.vue'

/** One metric condition, edited in place (the parent's reactive spec owns it). */
const props = defineProps<{ filter: MetricFilter; reference: ReferenceLine | null; testid?: string }>()
const emit = defineEmits<{ remove: [] }>()

const { t } = useI18n()
const { label } = useMetrics()

function unitHint(key: NumericMetricKey) {
  const unit = metricField(key).unit
  return unit === 'ratio' ? '0.03' : unit === 'cnyPerUnit' ? '3' : ''
}

function onOpChange() {
  const f = props.filter as any
  if (f.op === 'between' && !Array.isArray(f.value)) f.value = [0, Number(f.value) || 0]
  else if (f.op !== 'between' && Array.isArray(f.value)) f.value = f.value[1]
  else if (f.op === 'percentileGte' && (Number(f.value) < 0 || Number(f.value) > 100)) f.value = 75
}
</script>
