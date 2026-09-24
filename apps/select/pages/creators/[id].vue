<template>
  <PanelPage
    testid="screen-c-creator"
    :title="creator?.displayName || t('kcs.creators.title')"
    :eyebrow="t('kcs.nav.select')"
    :lead="creator?.regions?.length ? creator.regions.join(' · ') : undefined"
  >
    <template #actions>
      <Button as-child variant="outline" size="sm">
        <NuxtLink :to="localePath('/')">
          <ArrowLeft class="size-4" />
          {{ t('kcs.panel.pool') }}
        </NuxtLink>
      </Button>
    </template>

    <div v-if="loading" class="grid gap-4 lg:grid-cols-3">
      <Skeleton v-for="i in 6" :key="i" class="h-40 rounded-xl" />
    </div>

    <template v-else-if="creator">
      <!-- 身份条 -->
      <Card class="gap-0 border-border/60 py-0 shadow-xs">
        <div class="flex flex-wrap items-center gap-4 px-5 py-4">
          <Avatar class="size-12 border border-border">
            <AvatarImage v-if="creator.avatarUrl" :src="creator.avatarUrl" :alt="creator.displayName" />
            <AvatarFallback class="bg-muted text-sm text-muted-foreground">{{ creator.displayName?.charAt(0) }}</AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-semibold tracking-tight">{{ creator.displayName }}</h2>
              <TierBadge :tier="creator.tier" />
              <HealthBadge :health="metrics.health" :low-active="metrics.lowActive" />
              <SourceBadge :source="creator.source" :mode="creator.sourceMode" />
            </div>
            <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span v-if="creator.xhsId" class="font-mono">@{{ creator.xhsId }}</span>
              <span v-if="creator.metricsFetchedAt">{{ t('kcs.source.fetchedAt') }} · {{ formatDate(creator.metricsFetchedAt) }}</span>
              <span v-if="creator.metricsLocked" class="inline-flex items-center gap-1 text-primary">
                <Lock class="size-3" />
                {{ t('kcs.source.locked') }}
              </span>
              <span v-if="creator.cohort?.size" class="inline-flex items-center gap-1" data-testid="creator-cohort">
                <Users class="size-3" />
                {{ t('kcs.band.cohort', { n: creator.cohort.size, source: creator.cohort.source ? t(`kcs.source.${creator.cohort.source}`) : '', window: creator.cohort.window }) }}
              </span>
              <span v-if="creator.stale" class="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300" data-testid="creator-stale">
                {{ t('kcs.band.stale') }}
              </span>
            </p>
          </div>
          <div class="grid grid-cols-3 gap-4 text-right">
            <div v-for="key in headline" :key="key">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ label(key) }}</p>
              <p class="text-lg font-semibold">
                <MetricValue :metric-key="key" :value="metrics[key]" :rank="percentiles[key]" :cohort="creator.cohort" :stale="creator.stale" compact />
              </p>
              <p v-if="percentiles[key]" class="text-[11px] tabular-nums text-muted-foreground" data-testid="headline-percentile" :data-scope="percentiles[key]!.scope">
                {{ percentiles[key]!.scope === 'platform' ? t('kcs.band.platform', { pct: percentiles[key]!.percentile }) : `${t('kcs.band.library')} · ${bandLabel(percentiles[key]!.band)}` }}
              </p>
              <p v-if="references[key]" class="text-[11px] tabular-nums text-muted-foreground/80" data-testid="headline-reference">
                {{ t('kcs.query.referenceDetail', { p25: format(key, references[key]!.p25), p50: format(key, references[key]!.p50), p75: format(key, references[key]!.p75) }) }}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <MetricCompare
        :locked="creator.metrics"
        :latest="creator.metricsLatest ?? creator.metrics"
        :locked-at="creator.metricsLockedAt"
        :latest-at="creator.metricsFetchedAt"
        :lead="t('kcs.compare.leadSelect')"
        :testid="TESTID.metricCompare"
      />

      <!-- 趋势：每次抓取一条快照 -->
      <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="creator-trend">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-3">
          <div>
            <h3 class="text-sm font-semibold">{{ t('kcs.creators.trend') }}</h3>
            <p class="text-xs text-muted-foreground">{{ t('kcs.creators.trendLead') }}</p>
          </div>
          <div class="inline-flex rounded-md border border-border bg-muted/40 p-0.5" role="group">
            <button
              v-for="w in [30, 90]"
              :key="w"
              type="button"
              class="h-7 rounded-[6px] px-2.5 text-xs font-medium transition-colors"
              :class="historyWindow === w ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
              :aria-pressed="historyWindow === w"
              @click="historyWindow = w as 30 | 90"
            >
              {{ t(`kcs.ingest.window${w}`) }}
            </button>
          </div>
        </div>
        <div v-if="loadingHistory" class="grid gap-4 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton v-for="i in 4" :key="i" class="h-10 rounded-md" />
        </div>
        <template v-else-if="snapshots.length">
          <div class="grid gap-4 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTrend v-for="key in trendKeys" :key="key" :metric-key="key" :snapshots="snapshots" />
          </div>
          <details class="border-t border-border/60">
            <summary class="cursor-pointer select-none px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground">
              {{ t('kcs.creators.snapshots', { n: snapshots.length }) }}
            </summary>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead class="text-left text-muted-foreground">
                  <tr class="border-t border-border/40">
                    <th class="px-5 py-2 font-medium">{{ t('kcs.source.fetchedAt') }}</th>
                    <th class="px-3 py-2 font-medium">{{ t('kcs.ingest.source') }}</th>
                    <th v-for="key in trendKeys" :key="key" class="px-3 py-2 text-right font-medium">{{ label(key) }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in [...snapshots].reverse()" :key="s.id" class="border-t border-border/40">
                    <td class="px-5 py-2 tabular-nums">{{ formatDate(s.fetchedAt) }}</td>
                    <td class="px-3 py-2"><SourceBadge :source="s.source" /></td>
                    <td v-for="key in trendKeys" :key="key" class="px-3 py-2 text-right">
                      <MetricValue :metric-key="key" :value="s.metrics[key]" :dot="false" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </template>
        <p v-else class="px-5 py-4 text-sm text-muted-foreground">{{ t('kcs.creators.noHistory') }}</p>
      </Card>

      <!-- 六组指标 -->
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="creator-metrics">
        <Card v-for="group in groups" :key="group" class="gap-0 border-border/60 py-0 shadow-xs">
          <div class="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <h3 class="text-sm font-semibold">{{ groupLabel(group) }}</h3>
            <span class="text-[11px] text-muted-foreground">{{ t(`kcs.ingest.window${metrics.window === 90 ? 90 : 30}`) }}</span>
          </div>
          <dl class="divide-y divide-border/40">
            <div v-for="field in fieldsIn(group)" :key="field.key" class="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-2.5" :title="help(field.key)">
              <dt class="min-w-0">
                <span class="block truncate text-sm text-foreground">{{ label(field.key) }}</span>
                <span v-if="percentiles[field.key]" class="mt-1 block h-1 w-28 overflow-hidden rounded-full bg-muted">
                  <span class="block h-full rounded-full bg-primary/70" :style="{ width: `${percentiles[field.key]!.percentile}%` }" />
                </span>
              </dt>
              <dd class="text-right text-sm">
                <MetricValue :metric-key="field.key" :value="metrics[field.key]" :rank="percentiles[field.key]" :cohort="creator.cohort" :stale="creator.stale" />
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <!-- 受众 / 合作品牌 / 平台指数 -->
      <div class="grid gap-4 lg:grid-cols-3">
        <Card class="gap-0 border-border/60 py-0 shadow-xs lg:col-span-2">
          <div class="border-b border-border/60 px-5 py-3"><h3 class="text-sm font-semibold">{{ t('kcs.panel.audience') }}</h3></div>
          <div v-if="metrics.audience" class="grid gap-5 px-5 py-4 sm:grid-cols-3">
            <div>
              <p class="text-xs text-muted-foreground">{{ t('kcs.panel.female') }}</p>
              <p class="mt-1 text-2xl font-semibold tabular-nums">{{ metrics.audience.femaleRatio == null ? '—' : pct(metrics.audience.femaleRatio) }}</p>
              <ul class="mt-3 space-y-1.5">
                <li v-for="band in metrics.audience.ageBands" :key="band.band" class="flex items-center gap-2 text-xs">
                  <span class="w-12 font-mono text-muted-foreground">{{ band.band }}</span>
                  <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span class="block h-full bg-primary/70" :style="{ width: pct(band.ratio) }" /></span>
                  <span class="w-10 text-right tabular-nums">{{ pct(band.ratio) }}</span>
                </li>
              </ul>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('kcs.panel.regions') }}</p>
              <ul class="mt-2 space-y-1.5">
                <li v-for="r in metrics.audience.topRegions" :key="r.name" class="flex items-center justify-between text-sm">
                  <span>{{ r.name }}</span>
                  <span class="tabular-nums text-muted-foreground">{{ pct(r.ratio) }}</span>
                </li>
              </ul>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">{{ t('kcs.panel.interests') }}</p>
              <ul class="mt-2 flex flex-wrap gap-1.5">
                <li v-for="i in metrics.audience.interests" :key="i.name" class="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs">
                  {{ i.name }} <span class="tabular-nums text-muted-foreground">{{ pct(i.ratio) }}</span>
                </li>
              </ul>
            </div>
          </div>
          <EmptyState v-else :title="t('kcs.panel.noAudience')" />
        </Card>

        <div class="flex flex-col gap-4">
          <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="creator-sources">
            <div class="border-b border-border/60 px-5 py-3">
              <h3 class="text-sm font-semibold">{{ t('kcs.creators.sources') }}</h3>
              <p class="text-xs text-muted-foreground">{{ t('kcs.creators.sourcesLead') }}</p>
            </div>
            <ul class="divide-y divide-border/40">
              <li v-for="link in sourceLinks" :key="`${link.source}:${link.externalId}`" class="flex items-center justify-between gap-3 px-5 py-2.5">
                <SourceBadge :source="link.source" />
                <span v-if="link.lastSeenAt" class="shrink-0 text-[11px] tabular-nums text-muted-foreground">{{ t('kcs.creators.lastSeen', { date: formatDate(link.lastSeenAt) }) }}</span>
              </li>
            </ul>
          </Card>
          <Card class="gap-0 border-border/60 py-0 shadow-xs">
            <div class="border-b border-border/60 px-5 py-3"><h3 class="text-sm font-semibold">{{ t('kcs.panel.collabBrands') }}</h3></div>
            <div class="px-5 py-4">
              <div v-if="metrics.coopBrands?.length" class="flex flex-wrap gap-1.5">
                <span v-for="b in metrics.coopBrands" :key="b" class="rounded-md border border-border/60 px-2 py-0.5 text-xs">{{ b }}</span>
              </div>
              <p v-else class="text-sm text-muted-foreground">—</p>
            </div>
          </Card>
          <Card v-if="metrics.vendorIndex" class="gap-0 border-border/60 py-0 shadow-xs">
            <div class="border-b border-border/60 px-5 py-3"><h3 class="text-sm font-semibold">{{ metrics.vendorIndex.name }}</h3></div>
            <div class="flex items-end gap-2 px-5 py-4">
              <span class="text-3xl font-semibold tabular-nums">{{ metrics.vendorIndex.value }}</span>
              <span class="pb-1 text-sm text-muted-foreground">/ {{ metrics.vendorIndex.max }}</span>
            </div>
          </Card>
        </div>
      </div>
    </template>

    <EmptyState v-else :title="t('kcs.creators.emptyTitle')" />
  </PanelPage>
</template>

<script setup lang="ts">
import { ArrowLeft, Lock, Users } from 'lucide-vue-next'
import {
  API,
  apiPath,
  TESTID,
  emptyMetrics,
  type CreatorMetrics,
  type CreatorSourceLink,
  type MetricPercentiles,
  type MetricSnapshot,
  type NumericMetricKey,
} from '@kcs/contract'

const { t, locale } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const { request } = useApi()
const { label, help, groupLabel, groups, fieldsIn, bandLabel, format } = useMetrics()

const creator = ref<any>(null)
const loading = ref(true)
const headline: NumericMetricKey[] = ['cpe', 'engagementRate', 'readToFollowerRatio']
const trendKeys: NumericMetricKey[] = ['followers', 'readMedian', 'engagementRate', 'cpe']

const snapshots = ref<MetricSnapshot[]>([])
const loadingHistory = ref(true)
const historyWindow = ref<30 | 90>(30)

const metrics = computed<CreatorMetrics>(() => ({ ...emptyMetrics(), ...(creator.value?.metrics ?? {}) }))
const percentiles = computed<MetricPercentiles>(() => creator.value?.percentiles ?? {})
/** 本库同组同量级的 25/50/75 分位（组内 ≥ 30 人才有）。 */
const references = computed<Partial<Record<NumericMetricKey, { n: number; p25: number; p50: number; p75: number }>>>(
  () => creator.value?.referenceLines ?? {},
)
/** 归并后的全部来源；老数据没有 sources 时退回主来源。 */
const sourceLinks = computed<CreatorSourceLink[]>(() => {
  const links: CreatorSourceLink[] = creator.value?.sources ?? []
  if (links.length) return links
  if (!creator.value?.source) return []
  return [
    {
      source: creator.value.source,
      externalId: creator.value.externalId ?? creator.value.creatorKey,
      firstSeenAt: creator.value.metricsFetchedAt ?? '',
      lastSeenAt: creator.value.metricsFetchedAt ?? '',
    },
  ]
})

async function loadHistory() {
  loadingHistory.value = true
  try {
    const res = await request<{ snapshots: MetricSnapshot[] }>(apiPath(API.poolCreatorHistory, { id: String(route.params.id) }, { window: historyWindow.value, limit: 60 }))
    snapshots.value = res.snapshots ?? []
  } catch {
    snapshots.value = []
  } finally {
    loadingHistory.value = false
  }
}
watch(historyWindow, loadHistory)

function pct(n: number | null | undefined) {
  return n == null ? '—' : new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(n)
}
function formatDate(iso: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(iso))
}

onMounted(async () => {
  try {
    creator.value = await request(apiPath(API.poolCreator, { id: String(route.params.id) }))
  } catch {
    creator.value = null
  } finally {
    loading.value = false
  }
  if (creator.value) await loadHistory()
  else loadingHistory.value = false
})
</script>
