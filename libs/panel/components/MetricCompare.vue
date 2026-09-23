<template>
  <Card class="gap-0 border-border/60 py-0 shadow-xs" :data-testid="testid">
    <div class="border-b border-border/60 px-5 py-3">
      <h3 class="text-sm font-semibold">{{ t('kcs.compare.title') }}</h3>
      <p class="text-xs text-muted-foreground">{{ locked ? lead || t('kcs.compare.lead') : t('kcs.compare.notPublished') }}</p>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[22rem] text-sm">
        <thead class="text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-5 py-2 font-medium">{{ t('kcs.compare.metric') }}</th>
            <th class="px-3 py-2 text-right font-medium" data-col="locked">
              <span class="block">{{ t('kcs.compare.locked') }}</span>
              <span v-if="lockedAt" class="block text-[11px] font-normal tabular-nums">{{ formatDate(lockedAt) }}</span>
            </th>
            <th class="px-3 py-2 text-right font-medium" data-col="latest">
              <span class="block">{{ t('kcs.compare.latest') }}</span>
              <span v-if="latestAt" class="block text-[11px] font-normal tabular-nums">{{ formatDate(latestAt) }}</span>
            </th>
            <th class="px-5 py-2 text-right font-medium">{{ t('kcs.compare.change') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="key in keys" :key="key" class="border-t border-border/40" :data-metric="key">
            <td class="px-5 py-2 text-foreground">{{ label(key) }}</td>
            <td class="px-3 py-2 text-right" data-col="locked">
              <MetricValue v-if="locked" :metric-key="key" :value="locked[key]" :dot="false" />
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="px-3 py-2 text-right" data-col="latest">
              <MetricValue :metric-key="key" :value="latest?.[key]" :dot="false" />
            </td>
            <td class="px-5 py-2 text-right text-xs tabular-nums" :class="deltaClass(key)">{{ deltaText(key) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { metricField, type CreatorMetrics, type NumericMetricKey } from '@kcs/contract'

/**
 * 发布时 vs 最新：选人端按发布那一刻的数字筛选排序，抓取只更新最新数字。
 * 两列并排给人看差多少，是否重新发布由运营决定。
 */
const props = withDefaults(
  defineProps<{
    locked: Partial<CreatorMetrics> | null | undefined
    latest: Partial<CreatorMetrics> | null | undefined
    lockedAt?: string | null
    latestAt?: string | null
    keys?: NumericMetricKey[]
    lead?: string
    testid?: string
  }>(),
  {
    keys: () => ['followers', 'readMedian', 'interactionMedian', 'engagementRate', 'priceImage', 'priceVideo', 'cpe'],
    testid: 'metric-compare',
  },
)

const { t, locale } = useI18n()
const { label } = useMetrics()

function delta(key: NumericMetricKey): number | null {
  const a = props.locked?.[key]
  const b = props.latest?.[key]
  if (typeof a !== 'number' || typeof b !== 'number' || a === 0) return null
  return (b - a) / Math.abs(a)
}
function deltaText(key: NumericMetricKey) {
  const d = delta(key)
  if (d == null) return '—'
  if (Math.abs(d) < 0.0005) return t('kcs.compare.same')
  return (d > 0 ? '+' : '') + new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(d)
}
function deltaClass(key: NumericMetricKey) {
  const d = delta(key)
  if (d == null || Math.abs(d) < 0.005) return 'text-muted-foreground'
  const good = metricField(key).better === 'low' ? d < 0 : d > 0
  return good ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
}
function formatDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}
</script>
