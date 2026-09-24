<template>
  <PanelPage testid="screen-a-home" :title="t('kcs.panel.opsHome')" :eyebrow="t('kcs.nav.ops')" :lead="t('kcs.panel.opsDesc')">
    <template #actions>
      <Button as-child>
        <NuxtLink data-testid="btn-create-creator" :to="localePath('/creators/new')">
          <UserPlus class="size-4" />
          {{ t('kcs.panel.createCreator') }}
        </NuxtLink>
      </Button>
    </template>

    <!-- 审核进度：待审核 / 有新数据待复核 / 已发布 / 已下架 -->
    <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiTile
        v-for="tile in tiles"
        :key="tile.key"
        :label="tile.label"
        :value="formatNumber(counts[tile.key])"
        :icon="tile.icon"
        :tone="tile.tone"
        :testid="`tile-${tile.key}`"
        :to="tile.to"
      />
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <TableCard :title="t('kcs.panel.recentBatches')" :description="t('kcs.panel.recentActivity')">
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead>{{ t('kcs.panel.batch') }}</TableHead>
              <TableHead class="hidden text-right sm:table-cell">{{ t('kcs.panel.ready') }}</TableHead>
              <TableHead class="w-28 sm:w-32">{{ t('kcs.panel.status') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="loading && !jobs.length">
              <TableRow v-for="i in 4" :key="`sk-${i}`" class="hover:bg-transparent">
                <TableCell><Skeleton class="h-4 w-40" /></TableCell>
                <TableCell class="hidden sm:table-cell"><Skeleton class="ml-auto h-4 w-8" /></TableCell>
                <TableCell><Skeleton class="h-5 w-16" /></TableCell>
              </TableRow>
            </template>
            <TableRow v-for="job in jobs" :key="job.id">
              <TableCell>
                <div class="flex items-center gap-3">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
                    <FileSpreadsheet class="size-4" />
                  </span>
                  <div class="min-w-0">
                    <div class="truncate font-medium text-foreground">{{ job.batchName || job.fileName || t('kcs.ingest.fetchTitle') }}</div>
                    <div class="truncate text-[11px] tabular-nums text-muted-foreground">
                      <template v-if="job.createdAt">{{ formatDate(job.createdAt) }}</template>
                      <span class="sm:hidden"> · {{ t('kcs.panel.ready') }} {{ formatNumber(job.writtenCount) }}</span>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell class="hidden text-right tabular-nums sm:table-cell">{{ formatNumber(job.writtenCount) }}</TableCell>
              <TableCell><StatusBadge :status="jobStatus(job)" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <EmptyState v-if="!loading && !jobs.length" :title="t('kcs.panel.emptyBatches')" :icon="FileSpreadsheet" />
      </TableCard>

      <aside class="space-y-4">
        <Card class="gap-0 border-border/60 py-0 shadow-xs">
          <div class="border-b border-border/60 px-4 py-3.5">
            <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ t('kcs.panel.overview') }}</h2>
          </div>
          <div class="space-y-3 p-4">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">{{ t('kcs.panel.openRate') }}</span>
              <span class="font-semibold tabular-nums text-foreground">{{ cleanRate }}</span>
            </div>
            <div class="flex h-2 overflow-hidden rounded-full bg-muted" role="img" :aria-label="t('kcs.panel.openRate')">
              <span class="bg-emerald-500/80 transition-[width] duration-500" :style="{ width: pct(counts.released) }" />
              <span class="bg-sky-500/70 transition-[width] duration-500" :style="{ width: pct(counts.ready) }" />
              <span class="bg-amber-500/70 transition-[width] duration-500" :style="{ width: pct(counts.review) }" />
            </div>
            <ul class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <li class="flex items-center gap-2"><span class="size-2 rounded-full bg-emerald-500/80" />{{ t('kcs.panel.released') }}</li>
              <li class="flex items-center gap-2"><span class="size-2 rounded-full bg-sky-500/70" />{{ t('kcs.panel.ready') }}</li>
              <li class="flex items-center gap-2"><span class="size-2 rounded-full bg-amber-500/70" />{{ t('kcs.panel.review') }}</li>
              <li class="flex items-center gap-2"><span class="size-2 rounded-full bg-muted-foreground/40" />{{ t('kcs.panel.draft') }}</li>
            </ul>
          </div>
        </Card>

        <Card class="gap-0 border-border/60 py-0 shadow-xs">
          <div class="border-b border-border/60 px-4 py-3.5">
            <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ t('kcs.panel.quickActions') }}</h2>
          </div>
          <div class="grid gap-1 p-2">
            <NuxtLink
              :to="localePath('/creators/new')"
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted"
            >
              <span class="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary"><UserPlus class="size-4" /></span>
              <span class="flex-1">
                <span class="block font-medium text-foreground">{{ t('kcs.panel.createCreator') }}</span>
                <span class="block text-xs text-muted-foreground">{{ t('kcs.panel.newCreator') }}</span>
              </span>
              <ChevronRight class="size-4 text-muted-foreground" />
            </NuxtLink>
            <a
              :href="`${config.public.selectUrl}/${locale}/`"
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted"
            >
              <span class="flex size-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300"><Users class="size-4" /></span>
              <span class="flex-1">
                <span class="block font-medium text-foreground">{{ t('kcs.panel.openSelect') }}</span>
                <span class="block text-xs text-muted-foreground">{{ t('kcs.panel.pool') }}</span>
              </span>
              <ExternalLink class="size-4 text-muted-foreground" />
            </a>
          </div>
        </Card>
      </aside>
    </div>
  </PanelPage>
</template>

<script setup lang="ts">
import { API, type OpsOverview, type OverviewJob } from '@kcs/contract'
import { Archive, ChevronRight, CheckCircle2, ClipboardCheck, ExternalLink, FileSpreadsheet, Search, UserPlus, Users } from 'lucide-vue-next'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()
const { request } = useApi()
const { formatNumber } = useFormat()
const counts = ref({ draft: 0, review: 0, ready: 0, released: 0, pending: 0, withdrawn: 0 })
const jobs = ref<OverviewJob[]>([])
const loading = ref(true)

const creatorsTab = (tab: string) => localePath({ path: '/creators', query: { tab } })
const tiles = computed(() => [
  { key: 'pending' as const, label: t('kcs.opsCreators.tabs.review'), icon: ClipboardCheck, tone: 'sand' as const, to: creatorsTab('review') },
  { key: 'review' as const, label: t('kcs.opsCreators.needsReview'), icon: Search, tone: 'sea' as const, to: undefined },
  { key: 'released' as const, label: t('kcs.opsCreators.tabs.released'), icon: CheckCircle2, tone: 'moss' as const, to: creatorsTab('released') },
  { key: 'withdrawn' as const, label: t('kcs.opsCreators.tabs.withdrawn'), icon: Archive, tone: 'ink' as const, to: creatorsTab('withdrawn') },
])

const total = computed(() => counts.value.draft + counts.value.review + counts.value.ready + counts.value.released)
const pct = (n: number) => (total.value ? `${(n / total.value) * 100}%` : '0%')
const cleanRate = computed(() => {
  if (!total.value) return '—'
  return new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(
    (counts.value.ready + counts.value.released) / total.value,
  )
})

/** 任务写成功但有失败行：API 里状态仍是 ok，界面上标成「部分完成」。 */
function jobStatus(job: OverviewJob) {
  return job.status === 'ok' && job.failedCount > 0 ? 'partial' : job.status
}

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

onMounted(async () => {
  try {
    const data = await request<OpsOverview>(API.opsOverview.path)
    counts.value = data.counts
    jobs.value = data.recentJobs
  } finally {
    loading.value = false
  }
})
</script>
