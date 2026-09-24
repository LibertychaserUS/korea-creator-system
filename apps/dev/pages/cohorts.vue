<template>
  <PanelPage
    :testid="SCREEN_TESTID['B-cohorts']"
    :title="t('kcs.console.cohorts.title')"
    :eyebrow="t('kcs.nav.monitor')"
    :lead="t('kcs.console.cohorts.lead')"
  >
    <template #actions>
      <Button variant="outline" size="sm" :disabled="loading" @click="load">
        <RefreshCw class="size-4" :class="loading ? 'animate-spin' : ''" aria-hidden="true" />
        {{ t('kcs.panel.retry') }}
      </Button>
    </template>

    <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="cohort-rules">
      <div class="border-b border-border/60 px-4 py-3.5">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ t('kcs.console.cohorts.rulesTitle') }}</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">{{ t('kcs.console.cohorts.rulesLead') }}</p>
      </div>
      <ul class="grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2">
        <li class="flex gap-2"><span class="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />{{ t('kcs.console.cohorts.ruleNone', { n: BAND_MIN_SAMPLE }) }}</li>
        <li class="flex gap-2"><span class="mt-2 size-1.5 shrink-0 rounded-full bg-primary/50" aria-hidden="true" />{{ t('kcs.console.cohorts.ruleThree', { min: BAND_MIN_SAMPLE, max: FIVE_BAND_MIN_SAMPLE - 1 }) }}</li>
        <li class="flex gap-2"><span class="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />{{ t('kcs.console.cohorts.ruleFive', { n: FIVE_BAND_MIN_SAMPLE }) }}</li>
        <li v-if="report" class="flex gap-2"><span class="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />{{ t('kcs.console.cohorts.ruleStale', { n: report.rules.staleDays }) }}</li>
        <li v-if="report" class="flex gap-2"><span class="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />{{ t('kcs.console.cohorts.ruleSpan', { n: spanTimes }) }}</li>
        <li v-if="report" class="flex gap-2"><span class="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />{{ t('kcs.console.cohorts.ruleReference', { n: report.rules.referenceMinSample }) }}</li>
      </ul>
    </Card>

    <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="cohort-calibration">
      <div class="border-b border-border/60 px-4 py-3.5">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ t('kcs.console.cohorts.calibrationTitle') }}</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">{{ t('kcs.console.cohorts.calibrationLead') }}</p>
      </div>
      <div v-if="loading && !report" class="space-y-2 p-4">
        <Skeleton v-for="i in 3" :key="i" class="h-10 w-full" />
      </div>
      <p v-else-if="!report?.calibration.length" class="p-4 text-sm text-muted-foreground">{{ t('kcs.console.cohorts.calibrationEmpty') }}</p>
      <ul v-else class="divide-y divide-border/60">
        <li v-for="c in report.calibration" :key="c.source ?? '-'" class="px-4 py-3" :data-source="c.source ?? '-'">
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span class="text-sm font-medium text-foreground">{{ sourceName(c.source) }}</span>
            <span class="text-xs text-muted-foreground">{{ t('kcs.console.cohorts.computedAt', { time: formatDateTime(c.computedAt) }) }}</span>
          </div>
          <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
            <div>
              <dt class="text-muted-foreground">{{ t('kcs.console.cohorts.target') }}</dt>
              <dd class="text-base font-semibold tabular-nums text-foreground" data-testid="cohort-target">{{ formatNumber(c.target) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">{{ t('kcs.console.cohorts.required') }}</dt>
              <dd class="font-medium tabular-nums text-foreground">{{ c.required == null ? t('kcs.console.cohorts.notEnough') : formatNumber(c.required) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">{{ t('kcs.console.cohorts.method') }}</dt>
              <dd class="font-medium text-foreground">{{ t(c.method === 'bootstrap' ? 'kcs.console.cohorts.methodBootstrap' : 'kcs.console.cohorts.methodAnalytic') }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">{{ t('kcs.console.cohorts.poolSize') }}</dt>
              <dd class="font-medium tabular-nums text-foreground">{{ formatNumber(c.poolSize) }}</dd>
            </div>
          </dl>
          <p class="mt-2 text-xs leading-relaxed text-muted-foreground">
            {{ c.method === 'bootstrap'
              ? t('kcs.console.cohorts.basisBootstrap', { width: c.basis?.rules?.halfWidth ?? 10, times: c.basis?.rules?.resamples ?? 200 })
              : t('kcs.console.cohorts.basisAnalytic', { n: report.rules.analyticSample }) }}
          </p>
          <details v-if="metricRows(c).length" class="mt-2 text-xs">
            <summary class="cursor-pointer rounded-sm text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">{{ t('kcs.console.cohorts.byMetric') }}</summary>
            <div class="mt-2 overflow-x-auto">
              <table class="w-full min-w-[420px] text-left">
                <thead class="text-muted-foreground">
                  <tr>
                    <th scope="col" class="py-1 pr-3 font-medium">{{ t('kcs.console.cohorts.metric') }}</th>
                    <th scope="col" class="py-1 pr-3 text-right font-medium">{{ t('kcs.console.cohorts.values') }}</th>
                    <th scope="col" class="py-1 pr-3 text-right font-medium">{{ t('kcs.console.cohorts.required') }}</th>
                    <th scope="col" class="py-1 text-right font-medium">{{ t('kcs.console.cohorts.widthAtTarget', { n: c.target }) }}</th>
                  </tr>
                </thead>
                <tbody class="tabular-nums">
                  <tr v-for="m in metricRows(c)" :key="m.key" class="border-t border-border/60">
                    <td class="py-1 pr-3">{{ metricLabel(m.key) }}</td>
                    <td class="py-1 pr-3 text-right">{{ formatNumber(m.values) }}</td>
                    <td class="py-1 pr-3 text-right">{{ m.required == null ? t('kcs.console.cohorts.notReached') : formatNumber(m.required) }}</td>
                    <td class="py-1 text-right">{{ m.width == null ? '—' : t('kcs.console.cohorts.points', { n: m.width }) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </li>
      </ul>
    </Card>

    <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="cohort-groups">
      <div class="border-b border-border/60 px-4 py-3.5">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ t('kcs.console.cohorts.groupsTitle') }}</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">{{ t('kcs.console.cohorts.groupsLead') }}</p>
      </div>
      <p v-if="report && !report.groups.length" class="p-4 text-sm text-muted-foreground">{{ t('kcs.console.cohorts.groupsEmpty') }}</p>
      <ul v-else class="divide-y divide-border/60">
        <li v-for="g in report?.groups ?? []" :key="g.key" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm" :data-group="g.key">
          <span class="min-w-0 text-foreground">
            {{ sourceName(g.source) }} · {{ t('kcs.console.cohorts.window', { n: g.window }) }} · {{ formName(g.contentForm) }}
          </span>
          <span class="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
            <Badge variant="outline" :class="sizeTone(g.size)">{{ sizeLabel(g.size) }}</Badge>
            {{ t('kcs.console.cohorts.members', { n: formatNumber(g.size) }) }}
          </span>
        </li>
      </ul>
      <p v-if="report?.referenceLines.length" class="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
        {{ t('kcs.console.cohorts.referenceCount', { n: formatNumber(report.referenceLines.length) }) }}
      </p>
    </Card>
  </PanelPage>
</template>

<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import {
  API,
  BAND_MIN_SAMPLE,
  FIVE_BAND_MIN_SAMPLE,
  SCREEN_TESTID,
  SOURCE_IDS,
  type DevCohortCalibration,
  type DevCohortsReport,
  type NumericMetricKey,
} from '@kcs/contract'

const { t, te } = useI18n()
const { request } = useApi()
const { formatNumber, formatDateTime } = useFormat()
const { label } = useMetrics()

const report = ref<DevCohortsReport | null>(null)
const loading = ref(true)

const spanTimes = computed(() => formatNumber(10 ** (report.value?.rules.spanDecades ?? 1)))

function sourceName(source: string | null): string {
  if (source && (SOURCE_IDS as readonly string[]).includes(source)) return t(`kcs.source.${source}`)
  return source ?? t('kcs.console.cohorts.anySource')
}

function formName(form: string | null): string {
  const key = `kcs.console.cohorts.forms.${form ?? 'mixed'}`
  return te(key) ? t(key) : String(form)
}

function metricLabel(key: string): string {
  return te(`kcs.metric.${key}`) ? label(key as NumericMetricKey) : key
}

function metricRows(c: DevCohortCalibration) {
  return Object.entries(c.basis?.metrics ?? {}).map(([key, m]) => ({
    key,
    values: m.values,
    required: m.required,
    width: m.halfWidths?.[String(c.target)] ?? null,
  }))
}

function sizeLabel(n: number): string {
  if (n < BAND_MIN_SAMPLE) return t('kcs.console.cohorts.sizeNone')
  if (n < FIVE_BAND_MIN_SAMPLE) return t('kcs.console.cohorts.sizeThree')
  return t('kcs.console.cohorts.sizeFive')
}

function sizeTone(n: number): string {
  if (n < BAND_MIN_SAMPLE) return 'text-muted-foreground'
  if (n < FIVE_BAND_MIN_SAMPLE) return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
}

async function load() {
  loading.value = true
  try {
    report.value = await request<DevCohortsReport>(API.devCohorts.path)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
