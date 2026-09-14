<template>
  <PanelPage testid="screen-a-sources" :title="t('kcs.ingest.title')" :eyebrow="t('kcs.nav.ops')" :lead="t('kcs.ingest.lead')">
    <!-- 适配器：A 官方 / B 第三方 -->
    <div class="grid gap-4 md:grid-cols-3" data-testid="adapter-cards">
      <template v-if="loadingAdapters">
        <Skeleton v-for="i in 3" :key="i" class="h-44 rounded-xl" />
      </template>
      <Card
        v-for="a in adapters"
        :key="a.id"
        class="gap-0 border-border/60 py-0 shadow-xs transition-colors"
        :class="form.source === a.id ? 'border-primary/50 ring-2 ring-primary/20' : 'cursor-pointer hover:border-primary/30'"
        :data-testid="`adapter-${a.id}`"
        @click="form.source = a.id"
      >
        <div class="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{{ t('kcs.ingest.route') }} {{ a.route === 'official' ? 'A' : 'B' }} · {{ t(`kcs.source.${a.route}`) }}</p>
            <h3 class="mt-1 text-base font-semibold">{{ t(`kcs.source.${a.id}`) }}</h3>
          </div>
          <span
            class="inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium"
            :class="a.configured ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'"
          >
            <KeyRound class="size-3" />
            {{ a.configured ? t('kcs.source.configured') : t('kcs.source.notConfigured') }}
          </span>
        </div>
        <dl class="grid gap-2 px-5 py-4 text-xs">
          <div>
            <dt class="text-muted-foreground">{{ t('kcs.ingest.provides') }}</dt>
            <dd class="mt-1 flex flex-wrap gap-1">
              <span v-for="k in (a.provides || []).slice(0, 8)" :key="k" class="rounded-sm bg-muted px-1.5 py-0.5">{{ metricLabel(k) }}</span>
              <span v-if="(a.provides || []).length > 8" class="px-1 text-muted-foreground">+{{ a.provides.length - 8 }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-muted-foreground">{{ t('kcs.ingest.credentials') }}</dt>
            <dd class="mt-1 font-mono text-[11px] text-muted-foreground">
              <span class="text-foreground">{{ (a.envVars || []).join(' · ') }}</span>
              <span v-if="(a.optionalEnvVars || []).length" class="block opacity-70">{{ (a.optionalEnvVars || []).join(' · ') }}</span>
            </dd>
          </div>
        </dl>
      </Card>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <!-- 抓取参数表单 -->
      <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="fetch-form">
        <div class="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
          <Radar class="size-4 text-primary" />
          <h2 class="text-sm font-semibold">{{ t('kcs.ingest.fetchTitle') }}</h2>
          <SourceBadge :source="form.source" class="ml-auto" />
        </div>
        <form class="grid gap-4 px-5 py-5 sm:grid-cols-2" @submit.prevent="runFetch">
          <div>
            <Label for="f-source" class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.source') }}</Label>
            <div class="relative">
              <select id="f-source" v-model="form.source" data-testid="fetch-source" class="border-input h-9 w-full appearance-none rounded-md border bg-transparent pl-3 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <option v-for="a in adapters" :key="a.id" :value="a.id">{{ t(`kcs.source.${a.id}`) }}</option>
              </select>
              <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div>
            <span class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.window') }}</span>
            <div class="inline-flex rounded-md border border-border bg-muted/40 p-0.5" role="group">
              <button v-for="w in [30, 90]" :key="w" type="button" class="h-8 rounded-[6px] px-3 text-xs font-medium transition-colors" :class="form.window === w ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'" :aria-pressed="form.window === w" @click="form.window = w as 30 | 90">
                {{ t(`kcs.ingest.window${w}`) }}
              </button>
            </div>
          </div>
          <div :class="disabled('keyword')">
            <Label for="f-keyword" class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.keyword') }}</Label>
            <Input id="f-keyword" v-model="form.keyword" data-testid="fetch-keyword" class="h-9" :placeholder="t('kcs.ingest.keywordPlaceholder')" :disabled="!supports('keyword')" />
          </div>
          <div :class="disabled('category')">
            <Label for="f-category" class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.category') }}</Label>
            <Input id="f-category" v-model="form.category" class="h-9" :disabled="!supports('category')" />
          </div>
          <div :class="disabled('region')">
            <Label for="f-region" class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.region') }}</Label>
            <Input id="f-region" v-model="form.region" class="h-9" :disabled="!supports('region')" />
          </div>
          <div :class="disabled('limit')">
            <Label for="f-limit" class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.limit') }}</Label>
            <Input id="f-limit" v-model.number="form.limit" type="number" min="1" max="500" class="h-9 tabular-nums" :disabled="!supports('limit')" />
          </div>
          <fieldset :class="disabled('followersMin')">
            <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.followersRange') }}</legend>
            <div class="flex items-center gap-2">
              <Input v-model.number="form.followersMin" type="number" min="0" class="h-9 tabular-nums" :placeholder="t('kcs.panel.min')" :disabled="!supports('followersMin')" />
              <span class="text-muted-foreground/60">–</span>
              <Input v-model.number="form.followersMax" type="number" min="0" class="h-9 tabular-nums" :placeholder="t('kcs.panel.max')" :disabled="!supports('followersMax')" />
            </div>
          </fieldset>
          <fieldset :class="disabled('priceMin')">
            <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.priceRange') }}</legend>
            <div class="flex items-center gap-2">
              <Input v-model.number="form.priceMin" type="number" min="0" class="h-9 tabular-nums" :placeholder="t('kcs.panel.min')" :disabled="!supports('priceMin')" />
              <span class="text-muted-foreground/60">–</span>
              <Input v-model.number="form.priceMax" type="number" min="0" class="h-9 tabular-nums" :placeholder="t('kcs.panel.max')" :disabled="!supports('priceMax')" />
            </div>
          </fieldset>
          <fieldset class="sm:col-span-2" :class="disabled('health')">
            <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.health') }}</legend>
            <div class="inline-flex rounded-md border border-border bg-muted/40 p-0.5" role="group">
              <button v-for="h in healthIds" :key="h" type="button" class="h-8 rounded-[6px] px-3 text-xs font-medium transition-colors" :class="form.health.includes(h) ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'" :aria-pressed="form.health.includes(h)" :disabled="!supports('health')" @click="toggleHealth(h)">
                {{ t(`kcs.health.${h}`) }}
              </button>
            </div>
          </fieldset>

          <p v-if="current && !current.configured" class="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 sm:col-span-2" data-testid="fetch-fixture-note">
            <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
            {{ t('kcs.ingest.fixtureNote') }}
          </p>

          <div class="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" data-testid="fetch-run" :disabled="running || !form.source">
              <Play class="size-4" />
              {{ running ? t('kcs.ingest.running') : t('kcs.ingest.run') }}
            </Button>
            <p v-if="result" class="text-sm text-muted-foreground" data-testid="fetch-result">
              <template v-if="result.queued">
                {{ t('kcs.ingest.queued') }}
                <span class="ml-1 font-mono text-[11px]">{{ String(result.jobId).slice(0, 8) }}</span>
              </template>
              <template v-else>
                {{ t('kcs.ingest.done', { written: result.writtenCount ?? 0, skipped: result.skippedDupes ?? 0, failed: result.failedCount ?? 0 }) }}
                <SourceBadge :source="result.sourceId ?? form.source" :mode="result.sourceMode" class="ml-1" />
              </template>
            </p>
            <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          </div>
        </form>
      </Card>

      <!-- 抓取记录 -->
      <TableCard :title="t('kcs.ingest.jobs')" :description="t('kcs.ingest.transformLead')">
        <Table data-testid="table-fetch-jobs">
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead>{{ t('kcs.ingest.jobSource') }}</TableHead>
              <TableHead class="hidden md:table-cell">{{ t('kcs.ingest.jobQuery') }}</TableHead>
              <TableHead class="text-right">{{ t('kcs.ingest.jobWritten') }}</TableHead>
              <TableHead class="hidden text-right sm:table-cell">{{ t('kcs.ingest.jobFailed') }}</TableHead>
              <TableHead class="w-32">{{ t('kcs.panel.status') }}</TableHead>
              <TableHead class="w-20 text-right"><span class="sr-only">{{ t('kcs.ingest.jobActions') }}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="loadingJobs && !jobs.length">
              <TableRow v-for="i in 4" :key="`sk-${i}`" class="hover:bg-transparent">
                <TableCell><Skeleton class="h-4 w-32" /></TableCell>
                <TableCell class="hidden md:table-cell"><Skeleton class="h-4 w-40" /></TableCell>
                <TableCell><Skeleton class="ml-auto h-4 w-8" /></TableCell>
                <TableCell class="hidden sm:table-cell"><Skeleton class="ml-auto h-4 w-8" /></TableCell>
                <TableCell><Skeleton class="h-5 w-16" /></TableCell>
                <TableCell />
              </TableRow>
            </template>
            <TableRow v-for="job in jobs" :key="job.id" data-testid="row-fetch-job">
              <TableCell>
                <div class="flex flex-col gap-1">
                  <SourceBadge :source="job.sourceId" :mode="job.sourceMode" />
                  <span class="font-mono text-[11px] text-muted-foreground">{{ job.id.slice(0, 8) }}<template v-if="job.createdAt"> · {{ formatDate(job.createdAt) }}</template></span>
                </div>
              </TableCell>
              <TableCell class="hidden max-w-64 md:table-cell">
                <span class="block truncate font-mono text-[11px] text-muted-foreground" :title="describe(job.query)">{{ describe(job.query) || job.batchName || job.fileName || '—' }}</span>
              </TableCell>
              <TableCell class="text-right tabular-nums">{{ formatNumber(job.writtenCount) }}</TableCell>
              <TableCell class="hidden text-right tabular-nums sm:table-cell" :class="job.failedCount ? 'text-destructive' : 'text-muted-foreground'">{{ formatNumber(job.failedCount) }}</TableCell>
              <TableCell>
                <div class="flex flex-col items-start gap-1">
                  <StatusBadge :status="job.status" />
                  <span v-if="progress(job)" class="text-[11px] tabular-nums text-muted-foreground" :title="job.error || undefined">{{ progress(job) }}</span>
                </div>
              </TableCell>
              <TableCell class="text-right">
                <div class="inline-flex gap-1">
                  <Button
                    v-if="job.status === 'failed' || job.status === 'partial'"
                    variant="ghost"
                    size="icon"
                    class="size-7"
                    :title="t('kcs.ingest.retry')"
                    :disabled="acting === job.id"
                    data-testid="job-retry"
                    @click="act(job, 'retry')"
                  >
                    <RotateCcw class="size-3.5" />
                  </Button>
                  <Button
                    v-if="job.status === 'queued' || job.status === 'running'"
                    variant="ghost"
                    size="icon"
                    class="size-7 text-destructive hover:text-destructive"
                    :title="t('kcs.ingest.cancel')"
                    :disabled="acting === job.id"
                    data-testid="job-cancel"
                    @click="act(job, 'cancel')"
                  >
                    <X class="size-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <EmptyState v-if="!loadingJobs && !jobs.length" :title="t('kcs.ingest.noJobs')" :icon="Radar" />
      </TableCard>
    </div>
  </PanelPage>
</template>

<script setup lang="ts">
import { ChevronDown, KeyRound, Play, Radar, RotateCcw, TriangleAlert, X } from 'lucide-vue-next'
import { SOURCE_IDS, type HealthGrade, type SourceId, type SourceQuery } from '@kcs/contract'

type AdapterInfo = { id: SourceId; route: 'official' | 'vendor'; supports: string[]; provides: string[]; configured: boolean; envVars: string[]; optionalEnvVars?: string[] }

const { t, te, locale } = useI18n()
const { request } = useApi()
const { formatNumber } = useFormat()
const { label } = useMetrics()

const healthIds: HealthGrade[] = ['excellent', 'normal', 'abnormal']
const adapters = ref<AdapterInfo[]>([])
const jobs = ref<any[]>([])
const loadingAdapters = ref(true)
const loadingJobs = ref(true)
const running = ref(false)
const result = ref<any>(null)
const error = ref('')
const acting = ref<string | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | null = null

const form = reactive<SourceQuery & { health: HealthGrade[] }>({
  source: SOURCE_IDS[0],
  window: 30,
  keyword: '',
  category: '',
  region: '',
  followersMin: undefined,
  followersMax: undefined,
  priceMin: undefined,
  priceMax: undefined,
  health: ['excellent'],
  limit: 50,
})

const current = computed(() => adapters.value.find((a) => a.id === form.source))
function supports(key: string) {
  return !current.value || !current.value.supports?.length || current.value.supports.includes(key)
}
function disabled(key: string) {
  return supports(key) ? '' : 'opacity-50'
}
function toggleHealth(h: HealthGrade) {
  const i = form.health.indexOf(h)
  if (i >= 0) form.health.splice(i, 1)
  else form.health.push(h)
}
function metricLabel(key: string) {
  return te(`kcs.metric.${key}`) ? label(key as any) : key
}
function formatDate(iso: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}
function describe(q: any) {
  if (!q || typeof q !== 'object') return ''
  return Object.entries(q)
    .filter(([k, v]) => k !== 'source' && v !== '' && v != null && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : v}`)
    .join(' ')
}

async function loadAdapters() {
  try {
    const res = await request<any>('/api/ingest/adapters')
    adapters.value = res.items ?? res.adapters ?? res ?? []
    if (adapters.value.length && !adapters.value.some((a) => a.id === form.source)) form.source = adapters.value[0]!.id
  } finally {
    loadingAdapters.value = false
  }
}

/** 排队/进行中/部分完成时的进度说明：第几页、用了多少次调用、几点继续。 */
function progress(job: any): string {
  const parts: string[] = []
  if (job.pagesDone || job.quotaUsed) parts.push(t('kcs.ingest.progress', { pages: job.pagesDone ?? 0, calls: job.quotaUsed ?? 0 }))
  if (job.status === 'partial' && job.nextRunAt) parts.push(t('kcs.ingest.nextRun', { time: formatDate(job.nextRunAt) }))
  if (job.status === 'failed' && job.error) parts.push(String(job.error).slice(0, 60))
  return parts.join(' · ')
}

const hasActive = computed(() => jobs.value.some((j) => j.status === 'queued' || j.status === 'running'))

async function loadJobs() {
  try {
    const res = await request<any>('/api/ingest/jobs')
    const list = res.items ?? res.jobs ?? res ?? []
    jobs.value = list.filter((j: any) => SOURCE_IDS.includes(j.sourceId)).slice(0, 20)
  } finally {
    loadingJobs.value = false
    schedulePoll()
  }
}

/** worker 在后台跑，有活动任务时每 3 秒刷一次，没有就停。 */
function schedulePoll() {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = null
  if (!hasActive.value) return
  pollTimer = setTimeout(loadJobs, 3000)
}

async function act(job: any, action: 'retry' | 'cancel') {
  acting.value = job.id
  error.value = ''
  try {
    await request(`/api/ingest/jobs/${job.id}/${action}`, { method: 'POST' })
    await loadJobs()
  } catch (e: any) {
    error.value = e?.data?.error ?? e?.message ?? String(e)
  } finally {
    acting.value = null
  }
}

async function runFetch() {
  running.value = true
  error.value = ''
  result.value = null
  const body: Record<string, unknown> = { source: form.source, window: form.window, limit: form.limit }
  for (const k of ['keyword', 'category', 'region', 'followersMin', 'followersMax', 'priceMin', 'priceMax'] as const) {
    const v = (form as any)[k]
    if (v !== '' && v != null && supports(k)) body[k] = v
  }
  if (form.health.length && supports('health')) body.health = form.health
  try {
    const res = await request<any>('/api/ingest/fetch', { method: 'POST', body: JSON.stringify(body) })
    // 202：任务已入队，worker 按配额执行；201（sync=1）：直接拿到结果
    result.value = res.job && res.writtenCount == null ? { queued: true, jobId: res.job.id ?? res.job } : res
    await loadJobs()
  } catch (e: any) {
    error.value = e?.data?.error ?? e?.message ?? String(e)
  } finally {
    running.value = false
  }
}

onMounted(() => {
  loadAdapters()
  loadJobs()
})
onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer)
})
</script>
