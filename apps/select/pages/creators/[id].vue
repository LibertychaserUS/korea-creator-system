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
              <HealthBadge :health="metrics.health" />
              <SourceBadge :source="creator.source" :mode="creator.sourceMode" />
            </div>
            <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span v-if="creator.xhsId" class="font-mono">@{{ creator.xhsId }}</span>
              <span class="font-mono">{{ creator.creatorKey }}</span>
              <span v-if="creator.metricsFetchedAt">{{ t('kcs.source.fetchedAt') }} · {{ formatDate(creator.metricsFetchedAt) }}</span>
              <span v-if="creator.metricsLocked" class="inline-flex items-center gap-1 text-primary">
                <Lock class="size-3" />
                {{ t('kcs.source.locked') }}
              </span>
            </p>
          </div>
          <div class="grid grid-cols-3 gap-4 text-right">
            <div v-for="key in headline" :key="key">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ label(key) }}</p>
              <p class="text-lg font-semibold">
                <MetricValue :metric-key="key" :value="metrics[key]" :band="percentiles[key]?.band" :percentile="percentiles[key]?.percentile" compact />
              </p>
            </div>
          </div>
        </div>
      </Card>

      <!-- 六组指标 -->
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="creator-metrics">
        <Card v-for="group in groups" :key="group" class="gap-0 border-border/60 py-0 shadow-xs">
          <div class="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <h3 class="text-sm font-semibold">{{ groupLabel(group) }}</h3>
            <span class="text-[11px] text-muted-foreground">{{ t('kcs.ingest.window') }} · {{ metrics.window ?? 30 }}d</span>
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
                <MetricValue :metric-key="field.key" :value="metrics[field.key]" :band="percentiles[field.key]?.band" :percentile="percentiles[field.key]?.percentile" />
                <span v-if="field.derived" class="ml-1 font-mono text-[10px] text-muted-foreground" title="derived">ƒ</span>
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
import { ArrowLeft, Lock } from 'lucide-vue-next'
import { emptyMetrics, type CreatorMetrics, type MetricPercentiles, type NumericMetricKey } from '@kcs/contract'

const { t, locale } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const { request } = useApi()
const { label, help, groupLabel, groups, fieldsIn } = useMetrics()

const creator = ref<any>(null)
const loading = ref(true)
const headline: NumericMetricKey[] = ['cpe', 'engagementRate', 'readToFollowerRatio']

const metrics = computed<CreatorMetrics>(() => ({ ...emptyMetrics(), ...(creator.value?.metrics ?? {}) }))
const percentiles = computed<MetricPercentiles>(() => creator.value?.percentiles ?? {})

function pct(n: number | null | undefined) {
  return n == null ? '—' : new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(n)
}
function formatDate(iso: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(iso))
}

onMounted(async () => {
  try {
    creator.value = await request(`/api/select/creators/${route.params.id}`)
  } catch {
    creator.value = null
  } finally {
    loading.value = false
  }
})
</script>
