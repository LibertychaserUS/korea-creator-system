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
        role="button"
        tabindex="0"
        :aria-pressed="form.source === a.id"
        :aria-label="t('kcs.console.a11y.pickSource', { name: t(`kcs.source.${a.id}`) })"
        @click="form.source = a.id"
        @keydown.enter.prevent="form.source = a.id"
        @keydown.space.prevent="form.source = a.id"
      >
        <div class="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <p class="text-[11px] font-medium text-primary">{{ t(`kcs.source.${a.route}`) }}</p>
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
            <dd class="mt-1 text-foreground">
              {{ a.configured ? t('kcs.source.configuredHint') : t('kcs.source.notConfiguredHint') }}
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
            <DictionarySelect id="f-category" v-model="form.category" :options="dictionary?.category ?? []" :disabled="!supports('category')" testid="fetch-category" />
          </div>
          <div :class="disabled('region')">
            <Label for="f-region" class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.region') }}</Label>
            <DictionarySelect id="f-region" v-model="form.region" :options="dictionary?.region ?? []" :disabled="!supports('region')" testid="fetch-region" />
          </div>
          <div :class="disabled('limit')">
            <Label for="f-limit" class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.limit') }}</Label>
            <Input id="f-limit" v-model.number="form.limit" type="number" min="1" max="500" class="h-9 tabular-nums" :disabled="!supports('limit')" />
          </div>
          <fieldset :class="disabled('followersMin')">
            <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.followersRange') }}</legend>
            <div class="flex items-center gap-2">
              <Input v-model.number="form.followersMin" :aria-label="t('kcs.console.a11y.min', { field: t('kcs.ingest.followersRange') })" type="number" min="0" class="h-9 tabular-nums" :placeholder="t('kcs.panel.min')" :disabled="!supports('followersMin')" />
              <span class="text-muted-foreground/60">–</span>
              <Input v-model.number="form.followersMax" :aria-label="t('kcs.console.a11y.max', { field: t('kcs.ingest.followersRange') })" type="number" min="0" class="h-9 tabular-nums" :placeholder="t('kcs.panel.max')" :disabled="!supports('followersMax')" />
            </div>
          </fieldset>
          <fieldset :class="disabled('priceMin')">
            <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.ingest.priceRange') }}</legend>
            <div class="flex items-center gap-2">
              <Input v-model.number="form.priceMin" :aria-label="t('kcs.console.a11y.min', { field: t('kcs.ingest.priceRange') })" type="number" min="0" class="h-9 tabular-nums" :placeholder="t('kcs.panel.min')" :disabled="!supports('priceMin')" />
              <span class="text-muted-foreground/60">–</span>
              <Input v-model.number="form.priceMax" :aria-label="t('kcs.console.a11y.max', { field: t('kcs.ingest.priceRange') })" type="number" min="0" class="h-9 tabular-nums" :placeholder="t('kcs.panel.max')" :disabled="!supports('priceMax')" />
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
            <p v-if="result" class="text-sm text-muted-foreground" data-testid="fetch-result" :data-job-id="result.jobId ?? result.id ?? undefined">
              <template v-if="result.queued">{{ t('kcs.ingest.queued') }}</template>
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
              <TableHead class="min-w-44">{{ t('kcs.panel.status') }}</TableHead>
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
            <TableRow v-for="job in jobs" :key="job.id" data-testid="row-fetch-job" :data-job-id="job.id" :data-status="job.status">
              <TableCell>
                <div class="flex flex-col gap-1">
                  <SourceBadge :source="job.sourceId" :mode="job.sourceMode" />
                  <span v-if="job.createdAt" class="text-[11px] tabular-nums text-muted-foreground">{{ formatDate(job.createdAt) }}</span>
                </div>
              </TableCell>
              <TableCell class="hidden max-w-64 md:table-cell">
                <span class="block truncate text-xs text-muted-foreground" :title="describe(job.query)">{{ describe(job.query) || job.batchName || job.fileName || '—' }}</span>
              </TableCell>
              <TableCell class="text-right tabular-nums">{{ formatNumber(job.writtenCount) }}</TableCell>
              <TableCell class="hidden text-right tabular-nums sm:table-cell" :class="job.failedCount ? 'text-destructive' : 'text-muted-foreground'">{{ formatNumber(job.failedCount) }}</TableCell>
              <TableCell>
                <div class="flex flex-col items-start gap-1">
                  <StatusBadge :status="job.status" />
                  <span v-if="progress(job)" class="whitespace-normal text-[11px] leading-snug tabular-nums text-muted-foreground" :title="job.error || undefined">{{ progress(job) }}</span>
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
                    :aria-label="t('kcs.ingest.retry')"
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
                    :aria-label="t('kcs.ingest.cancel')"
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
import { API, apiPath, SOURCE_IDS, type HealthGrade, type SourceDictionaries, type SourceId, type SourceQuery } from '@kcs/contract'

type AdapterInfo = { id: SourceId; route: 'official' | 'vendor'; supports: string[]; provides: string[]; configured: boolean; envVars: string[]; optionalEnvVars?: string[] }

const { t, te, locale } = useI18n()
const { request } = useApi()
const { formatNumber } = useFormat()
const { label } = useMetrics()

const healthIds: HealthGrade[] = ['healthy', 'abnormal']
const adapters = ref<AdapterInfo[]>([])
const jobs = ref<any[]>([])
const loadingAdapters = ref(true)
const loadingJobs = ref(true)
const running = ref(false)
const result = ref<any>(null)
const error = ref('')
const acting = ref<string | null>(null)
const dictionary = ref<SourceDictionaries | null>(null)
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
  health: ['healthy'],
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
/** 把抓取参数说成人话：近 30 天 · 关键词 护肤 · 粉丝 1万–50万 · 只要健康。 */
function describe(q: any) {
  if (!q || typeof q !== 'object') return ''
  const parts: string[] = []
  if (q.window) parts.push(t(`kcs.ingest.window${q.window}`))
  if (q.keyword) parts.push(`${t('kcs.ingest.keyword')} ${q.keyword}`)
  if (q.category) parts.push(`${t('kcs.ingest.category')} ${q.category}`)
  if (q.region) parts.push(`${t('kcs.ingest.region')} ${q.region}`)
  if (q.followersMin != null || q.followersMax != null) parts.push(`${t('kcs.ingest.followersRange')} ${range(q.followersMin, q.followersMax)}`)
  if (q.priceMin != null || q.priceMax != null) parts.push(`${t('kcs.ingest.priceRange')} ${range(q.priceMin, q.priceMax)}`)
  if (Array.isArray(q.health) && q.health.length && q.health.length < healthIds.length) parts.push(q.health.map((h: HealthGrade) => t(`kcs.health.${h}`)).join(' / '))
  if (Array.isArray(q.externalIds) && q.externalIds.length) parts.push(t('kcs.ingest.byIds', { n: q.externalIds.length }))
  return parts.join(' · ')
}
function range(min?: number | null, max?: number | null) {
  const a = min == null ? '' : formatNumber(min)
  const b = max == null ? '' : formatNumber(max)
  return a && b ? `${a}–${b}` : a ? `≥ ${a}` : `≤ ${b}`
}

/** 类目 / 地域必须用平台自己的写法，换来源就换一份字典。 */
async function loadDictionary(source: SourceId) {
  dictionary.value = null
  const res = await request<SourceDictionaries>(apiPath(API.opsDictionaries, {}, { source })).catch(() => null)
  if (form.source === source) dictionary.value = res
}
watch(() => form.source, (source) => {
  form.category = ''
  form.region = ''
  loadDictionary(source)
})

async function loadAdapters() {
  try {
    const res = await request<any>(API.ingestAdapters.path)
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
  if (job.status === 'failed') parts.push(reason(job.errorCode))
  return parts.join(' · ')
}

/** 失败原因只给人话；原始报错留在悬浮提示里。 */
function reason(code: string | null | undefined): string {
  const key = `kcs.ingest.reason.${code || 'UNKNOWN'}`
  return te(key) ? t(key) : t('kcs.ingest.reason.UNKNOWN')
}

const hasActive = computed(() => jobs.value.some((j) => j.status === 'queued' || j.status === 'running'))

async function loadJobs() {
  try {
    const params = new URLSearchParams({ source: SOURCE_IDS.join(','), pageSize: '20' })
    const res = await request<any>(apiPath(API.ingestJobs, {}, params))
    jobs.value = res.items ?? []
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
    await request(apiPath(action === 'retry' ? API.ingestJobRetry : API.ingestJobCancel, { id: job.id }), { method: 'POST' })
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
    const res = await request<any>(API.ingestFetch.path, { method: 'POST', body: JSON.stringify(body) })
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
  loadDictionary(form.source)
})
onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer)
})
</script>
