<template>
  <PanelPage
    :testid="SCREEN_TESTID['B-pipeline']"
    :title="t('kcs.console.pipeline.title')"
    :eyebrow="t('kcs.nav.monitor')"
    :lead="t('kcs.console.pipeline.lead')"
  >
    <template #actions>
      <Button variant="outline" size="sm" :disabled="loading" @click="load">
        <RefreshCw class="size-4" :class="loading ? 'animate-spin' : ''" aria-hidden="true" />
        {{ t('kcs.panel.retry') }}
      </Button>
    </template>

    <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiTile :label="t('kcs.console.pipeline.totals.sources')" :value="formatNumber(report?.totals.sources)" :icon="Plug" tone="sea" />
      <KpiTile :label="t('kcs.console.pipeline.totals.jobs')" :value="formatNumber(report?.totals.jobs)" :icon="ListChecks" tone="sand" />
      <KpiTile :label="t('kcs.console.pipeline.totals.review')" :value="formatNumber(report?.totals.review)" :icon="Inbox" tone="ink" />
      <KpiTile :label="t('kcs.console.pipeline.totals.released')" :value="formatNumber(report?.totals.released)" :icon="BadgeCheck" tone="moss" />
    </div>

    <p v-if="report" class="text-xs text-muted-foreground" data-testid="pipeline-resets">
      {{ t('kcs.console.pipeline.resets', { time: formatDateTime(report.resetsAt) }) }}
    </p>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="pipeline-sources">
      <template v-if="loading && !report">
        <Card v-for="i in 3" :key="`sk-${i}`" class="gap-3 border-border/60 p-4 shadow-xs">
          <Skeleton class="h-5 w-32" />
          <Skeleton class="h-2 w-full" />
          <Skeleton class="h-12 w-full" />
        </Card>
      </template>
      <Card
        v-for="s in report?.sources ?? []"
        :key="s.id"
        class="gap-0 border-border/60 py-0 shadow-xs"
        :data-source-id="s.id"
      >
        <div class="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5">
          <div class="min-w-0">
            <h2 class="truncate text-sm font-semibold tracking-tight text-foreground">{{ sourceName(s) }}</h2>
            <p class="mt-0.5 text-[11px] text-muted-foreground">
              <template v-if="s.rateLimit">{{ t('kcs.console.pipeline.rate', { n: formatNumber(s.rateLimit) }) }}</template>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <Badge v-if="!s.enabled" variant="outline" class="text-muted-foreground">{{ t('kcs.console.pipeline.off') }}</Badge>
            <SourceBadge v-else-if="isSource(s.id)" :source="s.id" :mode="s.lastMode ?? undefined" class="h-5" />
          </div>
        </div>

        <div class="space-y-4 p-4">
          <div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-xs text-muted-foreground">{{ t('kcs.console.pipeline.cols.today') }}</span>
              <span class="text-sm tabular-nums">
                <span class="text-lg font-semibold text-foreground" data-testid="pipeline-calls-today">{{ formatNumber(s.callsToday) }}</span>
                <span v-if="s.quota != null" class="text-muted-foreground"> / {{ formatNumber(s.quota) }}</span>
              </span>
            </div>
            <div
              class="mt-2 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              :aria-label="t('kcs.console.pipeline.cols.today')"
              :aria-valuenow="s.callsToday"
              :aria-valuemin="0"
              :aria-valuemax="s.quota ?? undefined"
            >
              <span class="block h-full rounded-full transition-[width] duration-500" :class="usageBar(s.usageRatio)" :style="{ width: usageWidth(s.usageRatio) }" />
            </div>
            <p class="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
              <span>{{ s.usageRatio == null ? t('kcs.console.pipeline.noQuota') : t('kcs.console.pipeline.used', { pct: percent(s.usageRatio) }) }}</span>
              <span v-if="s.remainingToday != null">{{ t('kcs.console.pipeline.remaining', { n: formatNumber(s.remainingToday) }) }}</span>
            </p>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">{{ t('kcs.console.pipeline.cols.week') }}</p>
            <ol class="mt-2 flex h-10 items-end gap-1" :aria-label="t('kcs.console.pipeline.cols.week')">
              <li
                v-for="d in week(s)"
                :key="d.day"
                class="flex-1 rounded-sm"
                :class="d.today ? 'bg-primary' : 'bg-primary/35'"
                :style="{ height: d.height }"
                :title="t('kcs.console.pipeline.weekDay', { day: dayLabel(d.day), n: formatNumber(d.calls) })"
              >
                <span class="sr-only">{{ t('kcs.console.pipeline.weekDay', { day: dayLabel(d.day), n: formatNumber(d.calls) }) }}</span>
              </li>
            </ol>
          </div>

          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt class="text-muted-foreground">{{ t('kcs.console.pipeline.cols.work') }}</dt>
              <dd class="font-medium tabular-nums text-foreground">{{ formatNumber(s.running) }} / {{ formatNumber(s.waiting) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">{{ t('kcs.console.pipeline.cols.written') }}</dt>
              <dd class="font-medium tabular-nums text-foreground">{{ formatNumber(s.written24h) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">{{ t('kcs.console.pipeline.cols.failed') }}</dt>
              <dd class="font-medium tabular-nums" :class="s.failed24h ? 'text-destructive' : 'text-foreground'">{{ formatNumber(s.failed24h) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">{{ t('kcs.console.pipeline.cols.parked') }}</dt>
              <dd class="font-medium tabular-nums" :class="s.openDeadLetters ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'">{{ formatNumber(s.openDeadLetters) }}</dd>
            </div>
          </dl>

          <div class="space-y-0.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            <p v-if="!s.lastSuccessAt && !s.lastFailureAt">{{ t('kcs.console.pipeline.never') }}</p>
            <p v-if="s.lastSuccessAt">{{ t('kcs.console.pipeline.lastOk', { time: formatDateTime(s.lastSuccessAt) }) }}</p>
            <p v-if="s.lastFailureAt" class="text-destructive">
              {{ t('kcs.console.pipeline.lastFail', { time: formatDateTime(s.lastFailureAt) }) }}
              <template v-if="s.lastErrorCode"> · {{ reason(s.lastErrorCode) }}</template>
            </p>
          </div>
        </div>
      </Card>
    </div>
    <EmptyState v-if="!loading && report && !report.sources.length" :title="t('kcs.console.pipeline.empty')" :icon="Plug" />
  </PanelPage>
</template>

<script setup lang="ts">
import { BadgeCheck, Inbox, ListChecks, Plug, RefreshCw } from 'lucide-vue-next'
import { API, SCREEN_TESTID, SOURCE_IDS, type DevPipeline, type PipelineSourceView } from '@kcs/contract'

const { t, te, locale } = useI18n()
const { request } = useApi()
const { formatNumber, formatDateTime } = useFormat()

const report = ref<DevPipeline | null>(null)
const loading = ref(true)

const isSource = (id: unknown): id is (typeof SOURCE_IDS)[number] => typeof id === 'string' && (SOURCE_IDS as readonly string[]).includes(id)

function sourceName(s: PipelineSourceView): string {
  if (isSource(s.id)) return t(`kcs.source.${s.id}`)
  if (s.id === 'file-drop') return t('kcs.ingest.fileImport')
  return s.name || s.id
}

function reason(code: string): string {
  const key = `kcs.ingest.reason.${code}`
  return te(key) ? t(key) : t('kcs.ingest.reason.UNKNOWN')
}

function percent(ratio: number): string {
  return new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(ratio)
}

const usageWidth = (ratio: number | null) => `${Math.min(1, Math.max(0, ratio ?? 0)) * 100}%`

function usageBar(ratio: number | null): string {
  if (ratio == null) return 'bg-muted-foreground/30'
  if (ratio >= 0.9) return 'bg-destructive/80'
  if (ratio >= 0.7) return 'bg-amber-500/80'
  return 'bg-emerald-500/80'
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/** 最近 7 天每天一根柱子；没调用的日子也占位，今天高亮。 */
function week(s: PipelineSourceView) {
  const today = report.value?.day ?? ''
  const byDay = new Map(s.recentDays.map((d) => [d.day, d.calls]))
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6))
  const max = Math.max(1, ...days.map((d) => byDay.get(d) ?? 0))
  return days.map((day) => {
    const calls = byDay.get(day) ?? 0
    return { day, calls, today: day === today, height: `${Math.max(calls ? 8 : 4, (calls / max) * 100)}%` }
  })
}

function dayLabel(day: string): string {
  return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
}

async function load() {
  loading.value = true
  try {
    report.value = await request<DevPipeline>(API.devPipeline.path)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
