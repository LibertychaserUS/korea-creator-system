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
        <li class="flex gap-2 sm:col-span-2"><span class="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />{{ t('kcs.console.cohorts.ruleBasis') }}</li>
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

    <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="cohort-coverage">
      <div class="border-b border-border/60 px-4 py-3.5">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ t('kcs.console.cohorts.coverageTitle') }}</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">{{ t('kcs.console.cohorts.coverageLead') }}</p>
      </div>
      <div v-if="loading && !report" class="space-y-2 p-4">
        <Skeleton v-for="i in 2" :key="i" class="h-10 w-full" />
      </div>
      <p v-else-if="!coverage.length" class="p-4 text-sm text-muted-foreground">{{ t('kcs.console.cohorts.coverageEmpty') }}</p>
      <ul v-else class="divide-y divide-border/60">
        <li v-for="c in coverage" :key="c.source" class="px-4 py-3" :data-source="c.source">
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span class="text-sm font-medium text-foreground">{{ sourceName(c.source) }}</span>
            <Badge variant="outline" :class="c.enough ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'">
              {{ t('kcs.console.cohorts.limitedBy', { what: t(c.limitedBy === 'money' ? 'kcs.console.cohorts.limitedMoney' : 'kcs.console.cohorts.limitedQuota') }) }}
            </Badge>
          </div>
          <p class="mt-1.5 text-base font-semibold text-foreground" data-testid="coverage-line">{{ coverageLine(c) }}</p>
          <p v-if="c.knownCreators && c.refreshesPerDay > 0" class="mt-0.5 text-xs text-muted-foreground">{{ coverageAdvice(c) }}</p>
          <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
            <div>
              <dt class="text-muted-foreground">{{ t('kcs.console.cohorts.dailyBudget') }}</dt>
              <dd class="font-medium tabular-nums text-foreground">{{ c.budgetUsd == null ? t('kcs.console.cohorts.noBudget') : usd(c.budgetUsd) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">{{ t('kcs.console.cohorts.schedulerUses') }}</dt>
              <dd class="font-medium tabular-nums text-foreground">{{ t('kcs.console.cohorts.perDayCalls', { calls: formatNumber(c.dailyCalls) }) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">{{ t('kcs.console.cohorts.refreshesPerDay') }}</dt>
              <dd class="font-medium tabular-nums text-foreground">{{ t('kcs.console.cohorts.people', { n: formatNumber(Math.floor(c.refreshesPerDay)) }) }}</dd>
            </div>
            <div :title="t('kcs.console.cohorts.callsPerRefreshNote')">
              <dt class="text-muted-foreground">{{ t('kcs.console.cohorts.callsPerRefresh') }}</dt>
              <dd class="font-medium tabular-nums text-foreground">{{ t('kcs.console.cohorts.callsPerRefreshValue', { n: oneDecimal(c.callsPerRefresh) }) }}</dd>
            </div>
          </dl>
        </li>
      </ul>
    </Card>

    <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="cohort-backtest">
      <div class="border-b border-border/60 px-4 py-3.5">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ t('kcs.console.cohorts.backtestTitle') }}</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">{{ t('kcs.console.cohorts.backtestLead') }}</p>
      </div>
      <div v-if="loading && !report" class="space-y-2 p-4">
        <Skeleton v-for="i in 2" :key="i" class="h-10 w-full" />
      </div>
      <template v-else-if="backtest">
        <p v-if="backtest.status === 'insufficient'" class="px-4 pt-3 text-sm text-muted-foreground" data-testid="backtest-insufficient">
          {{ t('kcs.console.cohorts.backtestShort', {
            records: formatNumber(backtest.records),
            positives: formatNumber(backtest.positives),
            minRecords: formatNumber(backtest.rules.minRecords),
            minPositives: formatNumber(backtest.rules.minPositives),
          }) }}
        </p>
        <ul class="divide-y divide-border/60">
          <li v-for="c in backtest.comparisons" :key="c.key" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2.5 text-sm" :data-metric="c.key">
            <span class="min-w-0">
              <span class="text-foreground">{{ metricLabel(c.key) }}</span>
              <span class="ml-2 text-xs text-muted-foreground">{{ t('kcs.console.cohorts.backtestCurrent', { basis: basisName(c.current) }) }}</span>
              <span v-if="c.paired" class="ml-2 text-xs text-muted-foreground">· {{ t('kcs.console.cohorts.backtestPaired', { n: formatNumber(c.paired) }) }}</span>
            </span>
            <span class="flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground">
              <template v-if="c.verdict !== 'insufficient'">
                <span v-for="s in c.scores" :key="s.basis" :title="t('kcs.console.cohorts.backtestChance')">{{ basisName(s.basis) }} {{ s.auc == null ? '—' : percent(s.auc) }}</span>
              </template>
              <Badge variant="outline" :class="verdictTone(c)" data-testid="backtest-verdict">{{ verdictLabel(c) }}</Badge>
            </span>
          </li>
        </ul>
      </template>
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
  type BasisComparison,
  type DevCohortCalibration,
  type DevCohortsReport,
  type MetricBasis,
  type NumericMetricKey,
  type RefreshCoverage,
} from '@kcs/contract'

const { t, te, locale } = useI18n()
const { request } = useApi()
const { formatNumber, formatDateTime } = useFormat()
const { label } = useMetrics()

const report = ref<DevCohortsReport | null>(null)
const loading = ref(true)

const spanTimes = computed(() => formatNumber(10 ** (report.value?.rules.spanDecades ?? 1)))
const coverage = computed<RefreshCoverage[]>(() => report.value?.coverage ?? [])
const backtest = computed(() => report.value?.basisBacktest ?? null)

function usd(n: number): string {
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}
function percent(n: number): string {
  return new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(n)
}
function oneDecimal(n: number): string {
  return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(n)
}

function coverageLine(c: RefreshCoverage): string {
  if (!c.knownCreators) return t('kcs.console.cohorts.coverageNone')
  if (!(c.refreshesPerDay > 0) || c.intervalDays == null) return t('kcs.console.cohorts.coverageZero')
  return t('kcs.console.cohorts.coverageLine', { n: formatNumber(c.coveredCreators), days: oneDecimal(c.intervalDays) })
}

function coverageAdvice(c: RefreshCoverage): string {
  if (c.enough) return t('kcs.console.cohorts.coverageEnough')
  const days = oneDecimal(c.modelIntervalDays)
  return c.usdPerDayForAll == null
    ? t('kcs.console.cohorts.coverageShortUnpriced', { days })
    : t('kcs.console.cohorts.coverageShort', { days, usd: usd(c.usdPerDayForAll) })
}

function basisName(basis: MetricBasis): string {
  return basis === 'organic' || basis === 'all' ? t(`kcs.scope.traffic.${basis}`) : t(`kcs.scope.business.${basis}`)
}

function verdictLabel(c: BasisComparison): string {
  if (c.verdict === 'prefer' && c.better) {
    return c.better === c.current ? t('kcs.console.cohorts.verdict.keep') : t('kcs.console.cohorts.verdict.prefer', { basis: basisName(c.better) })
  }
  return t(`kcs.console.cohorts.verdict.${c.verdict}`)
}

function verdictTone(c: BasisComparison): string {
  if (c.verdict === 'prefer' && c.better && c.better !== c.current) return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  if (c.verdict === 'insufficient') return 'text-muted-foreground'
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
}

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
