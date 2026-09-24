<template>
  <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="card-capacity" :data-level="level">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5 sm:px-5">
      <div class="min-w-0">
        <h2 class="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          <HardDrive class="size-4 text-muted-foreground" aria-hidden="true" />
          {{ t('kcs.console.capacity.title') }}
          <Badge variant="outline" :class="levelTone" data-testid="capacity-level">{{ t(`kcs.console.capacity.level.${level}`) }}</Badge>
        </h2>
        <p class="mt-0.5 text-xs text-muted-foreground">{{ t('kcs.console.capacity.lead') }}</p>
      </div>
      <Button v-if="canSnapshot" variant="outline" size="sm" :disabled="busy" data-testid="btn-capacity-snapshot" @click="snapshot">
        <Loader2 v-if="busy" class="size-3.5 animate-spin" aria-hidden="true" />
        <Camera v-else class="size-3.5" aria-hidden="true" />
        {{ t('kcs.console.capacity.snapshot') }}
      </Button>
    </div>

    <div v-if="loading && !report" class="space-y-3 p-4 sm:p-5">
      <Skeleton class="h-6 w-2/3" />
      <Skeleton class="h-2.5 w-full" />
      <Skeleton class="h-16 w-full" />
    </div>

    <div v-else-if="!report || report.forecast.status === 'empty'" class="p-4 text-sm text-muted-foreground sm:p-5" data-testid="capacity-empty">
      {{ t('kcs.console.capacity.empty') }}
    </div>

    <div v-else class="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div class="min-w-0 space-y-4">
        <p class="text-lg font-semibold leading-snug text-foreground" data-testid="capacity-headline">{{ headline }}</p>
        <p v-if="secondLine" class="-mt-2 text-sm text-muted-foreground" data-testid="capacity-second">{{ secondLine }}</p>

        <div v-if="fc.capacity != null && fc.used != null">
          <div
            class="relative h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            :aria-label="t('kcs.console.capacity.title')"
            :aria-valuenow="Math.round((fc.usage ?? 0) * 100)"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span class="block h-full rounded-full transition-[width] duration-500" :class="barTone" :style="{ width: `${Math.min(100, (fc.usage ?? 0) * 100)}%` }" />
            <span class="absolute inset-y-0 left-[70%] w-px bg-amber-500/70" aria-hidden="true" />
            <span class="absolute inset-y-0 left-[90%] w-px bg-destructive/70" aria-hidden="true" />
          </div>
          <p class="mt-1.5 flex flex-wrap justify-between gap-2 text-xs tabular-nums text-muted-foreground">
            <span data-testid="capacity-used">{{ t('kcs.console.capacity.used', { used: formatBytes(fc.used), size: formatBytes(fc.capacity) }) }} · {{ percent(fc.usage) }}</span>
            <span v-if="report.latest?.disk?.declared">{{ t('kcs.console.capacity.declared') }}</span>
          </p>
        </div>
        <p v-else-if="report.latest?.databaseBytes != null" class="text-sm text-muted-foreground">
          {{ t('kcs.console.capacity.usedNoDisk', { size: formatBytes(report.latest.databaseBytes) }) }} · {{ t('kcs.console.capacity.noCapacity') }}
        </p>

        <svg v-if="spark.path" class="h-14 w-full overflow-visible" viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">
          <path :d="spark.area" class="fill-primary/10" />
          <path :d="spark.path" class="fill-none stroke-primary" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        </svg>

        <ul class="space-y-1.5 text-sm">
          <li v-if="fc.slope" class="text-muted-foreground" data-testid="capacity-growth">
            {{ fc.slope.perDay > 0
              ? t('kcs.console.capacity.growth', { size: formatBytes(fc.slope.perDay), low: formatBytes(Math.max(0, fc.slope.lower)), high: formatBytes(fc.slope.upper) })
              : t('kcs.console.capacity.shrinking') }}
          </li>
          <li v-if="worstCaseText" class="text-muted-foreground" data-testid="capacity-worst">{{ worstCaseText }}</li>
          <li v-if="fc.changePoint" class="flex items-start gap-2 text-amber-700 dark:text-amber-300" data-testid="capacity-change">
            <Activity class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {{ t('kcs.console.capacity.change', {
              day: dayLabel(fc.changePoint.day),
              dir: t(fc.changePoint.afterPerDay > fc.changePoint.beforePerDay ? 'kcs.console.capacity.faster' : 'kcs.console.capacity.slower'),
              before: formatBytes(fc.changePoint.beforePerDay),
              after: formatBytes(fc.changePoint.afterPerDay),
            }) }}
          </li>
          <li v-for="(r, i) in reasonLines" :key="i" class="flex items-start gap-2" :class="level === 'critical' ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'">
            <AlertTriangle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {{ r }}
          </li>
        </ul>
        <p v-if="report.lastReadingAt" class="text-[11px] text-muted-foreground">{{ t('kcs.console.capacity.lastReading', { time: formatDateTime(report.lastReadingAt) }) }}</p>
      </div>

      <div class="space-y-4">
        <div v-if="report.topGrowing.length">
          <h3 class="text-xs font-medium text-muted-foreground">{{ t('kcs.console.capacity.top') }}</h3>
          <ol class="mt-2 space-y-1.5" data-testid="capacity-top">
            <li v-for="row in report.topGrowing" :key="row.name" class="flex items-baseline justify-between gap-3 text-sm">
              <span class="truncate text-foreground" :title="row.name">{{ tableName(row.name) }}</span>
              <span class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ t('kcs.console.capacity.perDay', { size: formatBytes(row.perDay) }) }}</span>
            </li>
          </ol>
        </div>
        <div v-if="report.latest">
          <h3 class="text-xs font-medium text-muted-foreground">{{ t('kcs.console.capacity.breakdown') }}</h3>
          <dl class="mt-2 space-y-1.5 text-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('kcs.console.capacity.database') }}</dt>
              <dd class="tabular-nums text-foreground">{{ formatBytes(report.latest.databaseBytes) }}</dd>
            </div>
            <div v-if="report.latest.walBytes != null" class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('kcs.console.capacity.log') }}</dt>
              <dd class="tabular-nums text-foreground">{{ formatBytes(report.latest.walBytes) }}</dd>
            </div>
            <div v-if="report.latest.backup" class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('kcs.console.capacity.backup') }}</dt>
              <dd class="tabular-nums text-foreground">{{ formatBytes(report.latest.backup.bytes) }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Activity, AlertTriangle, Camera, HardDrive, Loader2 } from 'lucide-vue-next'
import { API, can, type CapacityForecast, type CapacityReport } from '@kcs/contract'

const { t, te, locale } = useI18n()
const { request } = useApi()
const { user } = useSession()
const { formatBytes, formatDateTime } = useFormat()

const report = ref<CapacityReport | null>(null)
const loading = ref(true)
const busy = ref(false)

const canSnapshot = computed(() => Boolean(user.value && can(user.value.role, 'dev.retry')))
const fc = computed<CapacityForecast>(() => report.value!.forecast)
const level = computed(() => report.value?.forecast.level ?? 'ok')

const levelTone = computed(() => {
  switch (level.value) {
    case 'critical':
      return 'border-destructive/30 bg-destructive/10 text-destructive'
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'notice':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
    default:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  }
})

const barTone = computed(() => {
  const usage = report.value?.forecast.usage ?? 0
  if (usage >= 0.9) return 'bg-destructive/80'
  if (usage >= 0.7) return 'bg-amber-500/80'
  return 'bg-emerald-500/80'
})

const percent = (ratio: number | null) =>
  ratio == null ? '—' : new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(ratio)

/** 天数说成人话：两周内按天、两个月内按周、两年内按月，再往后按年。 */
function when(days: number): string {
  const d = Math.max(1, Math.round(days))
  if (d < 14) return t('kcs.console.capacity.when.days', { n: d }, d)
  if (d < 60) {
    const n = Math.round(d / 7)
    return t('kcs.console.capacity.when.weeks', { n }, n)
  }
  if (d < 730) {
    const n = Math.round(d / 30.4)
    return t('kcs.console.capacity.when.months', { n }, n)
  }
  const n = Math.round(d / 365)
  return t('kcs.console.capacity.when.years', { n }, n)
}

const eta = (threshold: number) => report.value?.forecast.etas.find((e) => e.threshold === threshold) ?? null

const headline = computed(() => {
  const f = report.value?.forecast
  if (!f) return ''
  if (f.status === 'insufficient') return t('kcs.console.capacity.insufficient')
  if (f.status === 'no_capacity') return t('kcs.console.capacity.noCapacity')
  const e70 = eta(0.7)
  const e90 = eta(0.9)
  if (e90?.days === 0) return t('kcs.console.capacity.reached90')
  if (e70?.days === 0) return t('kcs.console.capacity.reached70')
  if (e70?.days != null) return t('kcs.console.capacity.eta70', { when: when(e70.days) })
  return t('kcs.console.capacity.steady')
})

const secondLine = computed(() => {
  const f = report.value?.forecast
  if (!f || f.status !== 'ok') return ''
  const e70 = eta(0.7)
  const e90 = eta(0.9)
  if (e90?.days != null && e90.days > 0 && e70?.days != null) return t('kcs.console.capacity.eta90', { when: when(e90.days) })
  return ''
})

const worstCaseText = computed(() => {
  const f = report.value?.forecast
  if (!f || f.worstCasePerDay == null || f.status !== 'ok') return ''
  const days = eta(0.7)?.daysWorstCase
  if (days === 0) return ''
  return days == null ? t('kcs.console.capacity.worstCaseNone') : t('kcs.console.capacity.worstCase', { when: when(days) })
})

const reasonLines = computed(() =>
  (report.value?.forecast.reasons ?? [])
    .filter((r) => r.kind !== 'change')
    .map((r) =>
      r.kind === 'usage'
        ? t('kcs.console.capacity.reason.usage', { usage: percent(r.usage), threshold: percent(r.threshold) })
        : r.kind === 'eta'
          ? t('kcs.console.capacity.reason.eta', { days: r.within, threshold: percent(r.threshold) })
          : '',
    ),
)

function tableName(name: string): string {
  const key = `kcs.console.capacity.tables.${name}`
  return te(key) ? t(key) : t('kcs.console.capacity.tables.other')
}

function dayLabel(day: string): string {
  return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
}

const spark = computed(() => {
  const values = (report.value?.history ?? []).map((h) => h.used ?? h.databaseBytes).filter((v): v is number => typeof v === 'number')
  if (values.length < 2) return { path: '', area: '' }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 300, 52 - ((v - min) / span) * 46] as const)
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return { path, area: `${path} L300 56 L0 56 Z` }
})

async function load() {
  loading.value = true
  try {
    report.value = await request<CapacityReport>(API.devCapacity.path)
  } catch {
    report.value = null
  } finally {
    loading.value = false
  }
}

async function snapshot() {
  busy.value = true
  try {
    await request(API.devCapacitySnapshot.path, { method: 'POST' })
    await load()
  } finally {
    busy.value = false
  }
}

onMounted(load)
defineExpose({ load })
</script>
