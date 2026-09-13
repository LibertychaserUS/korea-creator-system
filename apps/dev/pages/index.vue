<template>
  <PanelPage testid="screen-b-health" :title="t('kcs.panel.health')" :eyebrow="t('kcs.nav.monitor')" :lead="t('kcs.panel.devDesc')">
    <template #actions>
      <Button variant="outline" size="sm" :disabled="loading" @click="loadAll">
        <RefreshCw class="size-4" :class="loading ? 'animate-spin' : ''" />
        {{ t('kcs.panel.retry') }}
      </Button>
    </template>

    <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiTile label="SQL" :icon="Database" :tone="health.ok ? 'moss' : 'coral'" testid="tile-sql">
        <span class="flex items-center gap-2 text-xl md:text-2xl">
          <span class="relative flex size-2.5" aria-hidden="true">
            <span v-if="health.ok" class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
            <span class="relative inline-flex size-2.5 rounded-full" :class="health.ok ? 'bg-emerald-500' : 'bg-destructive'" />
          </span>
          <span v-if="health.ok" data-testid="dev-sql-ok">{{ t('kcs.panel.sqlOk') }}</span>
          <span v-else class="text-destructive">{{ t('kcs.panel.error') }}</span>
        </span>
      </KpiTile>
      <KpiTile :label="t('kcs.panel.jobs')" :icon="ListChecks" tone="sea">
        <span data-testid="dev-job-count">{{ formatNumber(jobCount) }}</span>
      </KpiTile>
      <KpiTile :label="t('kcs.panel.failures')" :value="formatNumber(failedCount)" :icon="AlertTriangle" :tone="failedCount ? 'coral' : 'ink'" />
      <KpiTile :label="t('kcs.panel.sources')" :value="formatNumber(health.sourcesEnabled)" :icon="Plug" tone="sand" />
    </div>

    <div class="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <!-- 状态分布 -->
      <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="table-jobs">
        <div class="border-b border-border/60 px-4 py-3.5">
          <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ t('kcs.panel.jobDistribution') }}</h2>
        </div>
        <div class="space-y-4 p-4">
          <div class="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" :aria-label="t('kcs.panel.jobDistribution')">
            <span
              v-for="row in distribution"
              :key="row.status"
              class="transition-[width] duration-500"
              :class="barClass(row.status)"
              :style="{ width: pct(row.n) }"
            />
          </div>
          <ul class="divide-y divide-border/60">
            <li v-for="row in distribution" :key="row.status" class="flex items-center justify-between py-2.5 text-sm">
              <StatusBadge :status="row.status" />
              <span class="flex items-baseline gap-2 tabular-nums">
                <span class="font-semibold text-foreground">{{ formatNumber(row.n) }}</span>
                <span class="w-10 text-right text-xs text-muted-foreground">{{ pctLabel(row.n) }}</span>
              </span>
            </li>
            <li v-if="!distribution.length && !loading" class="py-6 text-center text-sm text-muted-foreground">
              {{ t('kcs.panel.emptyBatches') }}
            </li>
          </ul>
        </div>
      </Card>

      <!-- 最近任务 -->
      <TableCard :title="t('kcs.panel.jobs')" :description="t('kcs.panel.recentActivity')">
        <template #meta>
          <span class="tabular-nums">{{ formatNumber(jobs.length) }}</span>
        </template>
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead>{{ t('kcs.panel.batch') }}</TableHead>
              <TableHead class="w-28">{{ t('kcs.panel.status') }}</TableHead>
              <TableHead class="hidden text-right sm:table-cell">{{ t('kcs.panel.ready') }}</TableHead>
              <TableHead class="hidden text-right md:table-cell">{{ t('kcs.panel.failures') }}</TableHead>
              <TableHead v-if="canRetry" class="w-24 text-right"><span class="sr-only">{{ t('kcs.panel.retry') }}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="loading && !jobs.length">
              <TableRow v-for="i in 5" :key="`sk-${i}`" class="hover:bg-transparent">
                <TableCell><Skeleton class="h-4 w-44" /></TableCell>
                <TableCell><Skeleton class="h-5 w-16" /></TableCell>
                <TableCell class="hidden sm:table-cell"><Skeleton class="ml-auto h-4 w-8" /></TableCell>
                <TableCell class="hidden md:table-cell"><Skeleton class="ml-auto h-4 w-8" /></TableCell>
                <TableCell v-if="canRetry" />
              </TableRow>
            </template>
            <TableRow v-for="job in jobs" :key="job.id" :data-job-id="job.id">
              <TableCell>
                <div class="min-w-0">
                  <div class="truncate font-medium text-foreground">{{ job.batch_name || job.file_name || job.id }}</div>
                  <div class="truncate font-mono text-[11px] text-muted-foreground">
                    {{ job.id }}<template v-if="job.updated_at"> · {{ formatDate(job.updated_at) }}</template>
                  </div>
                  <p v-if="job.status === 'failed' && job.error_summary" class="mt-1 truncate text-xs text-destructive">
                    {{ job.error_code ? `${job.error_code} · ` : '' }}{{ job.error_summary }}
                  </p>
                </div>
              </TableCell>
              <TableCell><StatusBadge :status="jobStatus(job)" /></TableCell>
              <TableCell class="hidden text-right tabular-nums sm:table-cell">{{ formatNumber(job.written_count) }}</TableCell>
              <TableCell class="hidden text-right tabular-nums md:table-cell" :class="Number(job.failed_count) ? 'text-destructive' : 'text-muted-foreground'">
                {{ formatNumber(job.failed_count) }}
              </TableCell>
              <TableCell v-if="canRetry" class="text-right">
                <Button
                  v-if="job.status === 'failed'"
                  data-testid="btn-retry-job"
                  size="sm"
                  variant="outline"
                  :disabled="retrying === job.id"
                  @click="retry(job.id)"
                >
                  <Loader2 v-if="retrying === job.id" class="size-3.5 animate-spin" />
                  <RotateCcw v-else class="size-3.5" />
                  {{ t('kcs.panel.retry') }}
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <EmptyState v-if="!loading && !jobs.length" :title="t('kcs.panel.emptyBatches')" :icon="ListChecks" />
      </TableCard>
    </div>
  </PanelPage>
</template>

<script setup lang="ts">
import { AlertTriangle, Database, ListChecks, Loader2, Plug, RefreshCw, RotateCcw } from 'lucide-vue-next'
import { can } from '@kcs/contract'

const { t, locale } = useI18n()
const { request } = useApi()
const { user } = useSession()
const { formatNumber } = useFormat()

const health = ref<any>({ jobs: [], sourcesEnabled: 0, ok: false, jobCount: 0 })
const jobs = ref<any[]>([])
const loading = ref(true)
const retrying = ref('')

const jobCount = computed(() => Number(health.value.jobCount ?? 0))
const canRetry = computed(() => Boolean(user.value && can(user.value.role, 'dev.retry')))

/** 写成功但有失败行：API 状态仍是 ok，界面上标成「部分完成」。 */
function jobStatus(job: { status: string; failed_count?: number | string | null }) {
  return job.status === 'ok' && Number(job.failed_count ?? 0) > 0 ? 'partial' : job.status
}

const ORDER = ['ok', 'running', 'queued', 'partial', 'failed']
const distribution = computed<any[]>(() =>
  [...(health.value.jobs || [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)),
)
const failedCount = computed(() => Number(distribution.value.find((r) => r.status === 'failed')?.n ?? 0))
const total = computed(() => distribution.value.reduce((s, r) => s + Number(r.n), 0))
const pct = (n: number) => (total.value ? `${(Number(n) / total.value) * 100}%` : '0%')
const pctLabel = (n: number) =>
  total.value ? new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(Number(n) / total.value) : '—'

function barClass(status: string) {
  switch (status) {
    case 'ok':
      return 'bg-emerald-500/80'
    case 'running':
      return 'bg-sky-500/70'
    case 'queued':
    case 'partial':
      return 'bg-amber-500/70'
    case 'failed':
      return 'bg-destructive/70'
    default:
      return 'bg-muted-foreground/40'
  }
}

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

async function loadAll() {
  loading.value = true
  try {
    const [h, j] = await Promise.all([
      request<any>('/api/dev/health'),
      request<any>('/api/dev/jobs').catch(() => ({ items: [] })),
    ])
    health.value = h
    jobs.value = (j.items || []).slice(0, 12)
  } catch {
    health.value = { ...health.value, ok: false }
  } finally {
    loading.value = false
  }
}

async function retry(id: string) {
  retrying.value = id
  try {
    await request(`/api/dev/jobs/${id}/retry`, { method: 'POST' })
    await loadAll()
  } finally {
    retrying.value = ''
  }
}

onMounted(loadAll)
</script>
