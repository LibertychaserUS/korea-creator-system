<template>
  <PanelPage
    :testid="TESTID.screenOpsCreator"
    :title="creator?.displayName || t('kcs.opsCreators.title')"
    :eyebrow="t('kcs.nav.ops')"
  >
    <template #actions>
      <Button as-child variant="outline" size="sm">
        <NuxtLink :to="backPath">
          <ArrowLeft class="size-4" />
          {{ t('kcs.opsCreator.back') }}
        </NuxtLink>
      </Button>
      <template v-if="creator">
        <Button v-if="canReadRaw" variant="outline" size="sm" :data-testid="TESTID.btnRaw" @click="openRaw">
          <FileSearch class="size-4" />
          {{ t('kcs.opsCreator.raw') }}
        </Button>
        <template v-if="canPublish">
          <Button v-if="creator.stage === 'review'" size="sm" :disabled="acting" :data-testid="TESTID.btnPublish" @click="ask('publish')">
            <Send class="size-4" />
            {{ t('kcs.opsCreator.approve') }}
          </Button>
          <Button v-else-if="creator.stage === 'withdrawn'" size="sm" :disabled="acting" :data-testid="TESTID.btnRepublish" @click="ask('republish')">
            <RotateCcw class="size-4" />
            {{ t('kcs.opsCreator.republish') }}
          </Button>
          <Button v-else variant="outline" size="sm" class="text-destructive hover:text-destructive" :disabled="acting" :data-testid="TESTID.btnUnpublish" @click="ask('unpublish')">
            <Archive class="size-4" />
            {{ t('kcs.opsCreator.unpublish') }}
          </Button>
        </template>
      </template>
    </template>

    <div v-if="loading" class="grid gap-4 lg:grid-cols-3">
      <Skeleton v-for="i in 6" :key="i" class="h-40 rounded-xl" />
    </div>

    <template v-else-if="creator">
      <!-- 身份条 -->
      <Card class="gap-0 border-border/60 py-0 shadow-xs">
        <div class="flex flex-wrap items-center gap-4 px-5 py-4">
          <Avatar class="size-12 border border-border">
            <AvatarFallback class="bg-primary/10 text-sm font-medium text-primary">{{ (creator.displayName || '?').charAt(0) }}</AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-semibold tracking-tight">{{ creator.displayName }}</h2>
              <span :data-testid="TESTID.creatorStatus" :data-status="creator.status" :data-stage="creator.stage">
                <StatusBadge kind="stage" :status="creator.stage" />
              </span>
              <TierBadge :tier="tierOf(latest.followers ?? creator.followers)" />
              <SourceBadge v-if="creator.source" :source="creator.source" />
              <span v-else class="text-xs text-muted-foreground">{{ t('kcs.opsCreators.manual') }}</span>
            </div>
            <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span v-if="creator.xhsId">{{ t('kcs.panel.xhsId') }} <span class="font-mono">{{ creator.xhsId }}</span></span>
              <span class="font-mono" :data-testid="TESTID.creatorKey" :data-creator-key="creator.creatorKey">{{ creator.creatorKey }}</span>
              <span v-if="creator.metricsLockedAt" class="inline-flex items-center gap-1 text-primary">
                <Lock class="size-3" />
                {{ t('kcs.opsCreator.publishedAt', { date: formatDate(creator.metricsLockedAt) }) }}
              </span>
              <span v-if="creator.updatedAt">{{ t('kcs.opsCreator.updatedAt', { date: formatDate(creator.updatedAt) }) }}</span>
            </p>
          </div>
        </div>
        <p
          v-if="creator.needsReview && creator.stage !== 'review'"
          class="flex items-start gap-2 border-t border-amber-500/20 bg-amber-500/5 px-5 py-2.5 text-xs text-amber-800 dark:text-amber-200"
        >
          <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
          {{ t('kcs.opsCreator.newNumbers') }}
        </p>
      </Card>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div class="flex min-w-0 flex-col gap-4">
          <MetricCompare
            :locked="creator.metricsLocked"
            :latest="latest"
            :locked-at="creator.metricsLockedAt"
            :latest-at="creator.metricsFetchedAt"
            :testid="TESTID.metricCompare"
          />

          <!-- 趋势：每天一条记录，按来源分线 -->
          <Card class="gap-0 border-border/60 py-0 shadow-xs" :data-testid="TESTID.creatorTrend">
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
            <div v-if="loadingHistory" class="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <Skeleton v-for="i in 4" :key="i" class="h-10 rounded-md" />
            </div>
            <template v-else-if="series.length">
              <div class="grid gap-4 px-5 py-4 sm:grid-cols-2">
                <MetricTrend v-for="key in trendKeys" :key="key" :metric-key="key" :series="series" />
              </div>
              <TrendHints :hints="hints" />
            </template>
            <p v-else class="px-5 py-4 text-sm text-muted-foreground">{{ t('kcs.creators.noHistory') }}</p>
          </Card>
        </div>

        <div class="flex min-w-0 flex-col gap-4">
          <!-- 资料编辑 -->
          <Card class="gap-0 border-border/60 py-0 shadow-xs">
            <div class="border-b border-border/60 px-5 py-3">
              <h3 class="text-sm font-semibold">{{ t('kcs.opsCreator.edit.title') }}</h3>
              <p class="text-xs text-muted-foreground">{{ canWrite ? t('kcs.opsCreator.edit.lead') : t('kcs.opsCreator.edit.readOnly') }}</p>
            </div>
            <form class="grid gap-4 px-5 py-4" :data-testid="TESTID.formCreatorEdit" @submit.prevent="save">
              <div class="grid gap-1.5">
                <Label for="edit-name" class="text-xs text-muted-foreground">{{ t('kcs.panel.displayName') }}</Label>
                <Input id="edit-name" v-model="form.displayName" maxlength="80" required :disabled="!canWrite" />
              </div>
              <div class="grid gap-1.5">
                <Label for="edit-followers" class="text-xs text-muted-foreground">{{ t('kcs.panel.followers') }}</Label>
                <div class="flex items-center gap-3">
                  <Input
                    id="edit-followers"
                    v-model.number="form.followers"
                    type="number"
                    min="0"
                    inputmode="numeric"
                    class="tabular-nums"
                    :disabled="!canWrite || form.followersUnknown"
                  />
                  <label class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <Switch v-model="form.followersUnknown" :disabled="!canWrite" />
                    {{ t('kcs.panel.unknownFollowers') }}
                  </label>
                </div>
              </div>
              <div class="grid gap-1.5">
                <Label for="edit-regions" class="text-xs text-muted-foreground">{{ t('kcs.opsCreator.edit.regions') }}</Label>
                <Input id="edit-regions" v-model="form.regions" :placeholder="t('kcs.opsCreator.edit.listHint')" :disabled="!canWrite" />
              </div>
              <div class="grid gap-1.5">
                <Label for="edit-verticals" class="text-xs text-muted-foreground">{{ t('kcs.opsCreator.edit.verticals') }}</Label>
                <Input id="edit-verticals" v-model="form.verticals" :placeholder="t('kcs.opsCreator.edit.listHint')" :disabled="!canWrite" />
              </div>
              <fieldset v-if="categories.length" class="grid gap-1.5">
                <legend class="mb-1.5 text-xs text-muted-foreground">{{ t('kcs.opsCreator.edit.categories') }}</legend>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="c in categories"
                    :key="c.slug"
                    type="button"
                    class="h-7 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-60"
                    :class="form.categories.includes(c.slug) ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'"
                    :aria-pressed="form.categories.includes(c.slug)"
                    :disabled="!canWrite"
                    :data-category="c.slug"
                    @click="toggleCategory(c.slug)"
                  >
                    {{ categoryName(c) }}
                  </button>
                </div>
              </fieldset>
              <div class="grid gap-1.5">
                <Label for="edit-note" class="text-xs text-muted-foreground">{{ t('kcs.opsCreator.edit.note') }}</Label>
                <Textarea id="edit-note" v-model="form.note" rows="3" :disabled="!canWrite" />
              </div>
              <div v-if="canWrite">
                <Button type="submit" size="sm" :disabled="saving || !form.displayName.trim()" :data-testid="TESTID.btnSaveCreatorEdit">
                  <Loader2 v-if="saving" class="size-4 animate-spin" />
                  <Save v-else class="size-4" />
                  {{ t('kcs.panel.save') }}
                </Button>
              </div>
            </form>
          </Card>

          <!-- 数据来源 -->
          <Card class="gap-0 border-border/60 py-0 shadow-xs" :data-testid="TESTID.creatorSources">
            <div class="border-b border-border/60 px-5 py-3">
              <h3 class="text-sm font-semibold">{{ t('kcs.creators.sources') }}</h3>
              <p class="text-xs text-muted-foreground">{{ t('kcs.creators.sourcesLead') }}</p>
            </div>
            <ul v-if="creator.sources?.length" class="divide-y divide-border/40">
              <li v-for="link in creator.sources" :key="`${link.source}:${link.externalId}`" class="flex items-center justify-between gap-3 px-5 py-2.5">
                <SourceBadge :source="link.source" />
                <span v-if="link.lastSeenAt" class="shrink-0 text-[11px] tabular-nums text-muted-foreground">{{ t('kcs.creators.lastSeen', { date: formatDate(link.lastSeenAt) }) }}</span>
              </li>
            </ul>
            <p v-else class="px-5 py-3 text-sm text-muted-foreground">{{ t('kcs.opsCreators.manual') }}</p>
          </Card>
        </div>
      </div>
    </template>

    <EmptyState v-else :title="t('kcs.opsCreator.notFound')" :icon="UserX">
      <Button as-child variant="outline" size="sm">
        <NuxtLink :to="backPath">{{ t('kcs.opsCreator.back') }}</NuxtLink>
      </Button>
    </EmptyState>

    <!-- 确认发布 / 下架 / 重新发布 -->
    <AlertDialog :open="Boolean(pending)" @update:open="(v: boolean) => { if (!v) pending = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ pending ? t(`kcs.opsCreator.confirm.${pending}Title`) : '' }}</AlertDialogTitle>
          <AlertDialogDescription>{{ pending ? t(`kcs.opsCreator.confirm.${pending}Body`) : '' }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="acting">{{ t('kcs.opsCreator.confirm.cancel') }}</AlertDialogCancel>
          <Button
            :variant="pending === 'unpublish' ? 'destructive' : 'default'"
            :disabled="acting"
            :data-testid="pending ? CONFIRM_TESTID[pending] : undefined"
            @click="confirm"
          >
            <Loader2 v-if="acting" class="size-4 animate-spin" />
            {{ t('kcs.opsCreator.confirm.ok') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- 平台原始信息 -->
    <Sheet v-model:open="rawOpen">
      <SheetContent side="right" class="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl" :data-testid="TESTID.sheetRaw">
        <SheetHeader class="border-b border-border/60 px-5 py-4">
          <SheetTitle>{{ t('kcs.opsCreator.raw') }}</SheetTitle>
          <SheetDescription>
            {{ t('kcs.opsCreator.rawSheet.lead') }}
            <span v-if="rawItems.length"> · {{ t('kcs.opsCreator.rawSheet.count', { n: rawItems.length }) }}</span>
          </SheetDescription>
        </SheetHeader>
        <div v-if="rawLoading" class="grid gap-3 p-5">
          <Skeleton v-for="i in 3" :key="i" class="h-24 rounded-lg" />
        </div>
        <EmptyState v-else-if="!rawItems.length" :title="t('kcs.opsCreator.rawSheet.empty')" :icon="FileSearch" />
        <ol v-else class="divide-y divide-border/60">
          <li v-for="(r, i) in rawItems" :key="r.id" class="grid gap-3 px-5 py-4" :data-testid="TESTID.rawRecord" :data-source="r.source">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <SourceBadge :source="r.source" />
              <span class="text-xs tabular-nums text-muted-foreground">{{ t('kcs.source.fetchedAt') }} · {{ formatDate(r.fetchedAt) }}</span>
            </div>
            <dl v-if="scalarFields(r.payload).length" class="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              <template v-for="[k, v] in scalarFields(r.payload)" :key="k">
                <dt class="truncate font-mono text-muted-foreground" :title="k">{{ k }}</dt>
                <dd class="break-all text-foreground">{{ v }}</dd>
              </template>
            </dl>
            <details :open="i === 0 && rawItems.length === 1" class="rounded-md border border-border/60 bg-muted/30">
              <summary class="cursor-pointer select-none px-3 py-2 text-xs text-muted-foreground hover:text-foreground">{{ t('kcs.opsCreator.rawSheet.expand') }}</summary>
              <pre class="max-h-96 overflow-auto border-t border-border/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground">{{ pretty(r.payload) }}</pre>
            </details>
          </li>
        </ol>
      </SheetContent>
    </Sheet>
  </PanelPage>
</template>

<script setup lang="ts">
import { Archive, ArrowLeft, FileSearch, Loader2, Lock, RotateCcw, Save, Send, TriangleAlert, UserX } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import {
  API,
  apiPath,
  type CategoryView,
  TESTID,
  can,
  emptyMetrics,
  tierOf,
  type CreatorMetrics,
  type CreatorStage,
  type CreatorTrends,
  type NumericMetricKey,
} from '@kcs/contract'

type Action = 'publish' | 'unpublish' | 'republish'
type RawRecord = { id: string; source: string; externalId: string; fetchedAt: string; payload: unknown }

const CONFIRM_TESTID: Record<Action, string> = {
  publish: TESTID.btnPublishConfirm,
  unpublish: TESTID.btnUnpublishConfirm,
  republish: TESTID.btnRepublishConfirm,
}
const COOP = ['collaborated', 'never_collaborated']

const { t, locale } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const { request } = useApi()
const { user } = useSession()

const creator = ref<any>(null)
const loading = ref(true)
const categories = ref<CategoryView[]>([])
const trendKeys: NumericMetricKey[] = ['followers', 'readMedian', 'engagementRate', 'cpe']
const trends = ref<CreatorTrends | null>(null)
const series = computed(() => trends.value?.series ?? [])
const hints = computed(() => trends.value?.hints ?? [])
const loadingHistory = ref(true)
const historyWindow = ref<30 | 90>(30)
const pending = ref<Action | null>(null)
const acting = ref(false)
const saving = ref(false)
const rawOpen = ref(false)
const rawLoading = ref(false)
const rawItems = ref<RawRecord[]>([])
let rawLoaded = false

const form = reactive({
  displayName: '',
  followers: undefined as number | undefined,
  followersUnknown: false,
  regions: '',
  verticals: '',
  categories: [] as string[],
  note: '',
})

const role = computed(() => user.value?.role ?? null)
const canWrite = computed(() => Boolean(role.value && can(role.value, 'ops.write')))
const canPublish = computed(() => Boolean(role.value && can(role.value, 'ops.publish')))
const canReadRaw = computed(() => Boolean(role.value && can(role.value, 'ingest.read')))
const latest = computed<CreatorMetrics>(() => ({ ...emptyMetrics(), ...(creator.value?.metrics ?? {}) }))
const backPath = computed(() => localePath({ path: '/creators', query: { tab: (creator.value?.stage as CreatorStage | undefined) ?? 'review' } }))

function fillForm() {
  const c = creator.value
  if (!c) return
  form.displayName = c.displayName ?? ''
  form.followers = c.followers ?? undefined
  form.followersUnknown = Boolean(c.followersUnknown)
  form.regions = (c.regions ?? []).join(', ')
  form.verticals = (c.verticals ?? []).join(', ')
  form.categories = [...(c.categories ?? [])]
  form.note = c.note ?? ''
}

const splitList = (v: string) => v.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)

function toggleCategory(slug: string) {
  const i = form.categories.indexOf(slug)
  if (i >= 0) {
    form.categories.splice(i, 1)
    return
  }
  // 合作过 / 没合作过 只能二选一
  if (COOP.includes(slug)) form.categories = form.categories.filter((s) => !COOP.includes(s))
  form.categories.push(slug)
}
function categoryName(c: CategoryView) {
  if (locale.value === 'en') return c.nameEn
  if (locale.value === 'ko') return c.nameKo
  return c.nameZh
}

async function load() {
  creator.value = await request<any>(apiPath(API.opsCreatorGet, { id: String(route.params.id) }))
  fillForm()
}

async function loadHistory() {
  loadingHistory.value = true
  try {
    trends.value = await request<CreatorTrends>(apiPath(API.opsCreatorTrends, { id: String(route.params.id) }, { window: historyWindow.value, limit: 60 }))
  } catch {
    trends.value = null
  } finally {
    loadingHistory.value = false
  }
}
watch(historyWindow, loadHistory)

function ask(action: Action) {
  pending.value = action
}

async function confirm() {
  const action = pending.value
  if (!action) return
  acting.value = true
  try {
    if (action === 'unpublish') {
      await request(apiPath(API.opsUnpublish, { id: String(route.params.id) }), { method: 'POST' })
      toast.success(t('kcs.opsCreator.toast.unpublished'))
    } else {
      const res = await request<{ refreshed: boolean }>(apiPath(API.opsPublish, { id: String(route.params.id) }), { method: 'POST' })
      toast.success(t(!res.refreshed ? 'kcs.opsCreator.toast.unchanged' : action === 'republish' ? 'kcs.opsCreator.toast.republished' : 'kcs.opsCreator.toast.published'))
    }
    pending.value = null
    await load()
  } catch (e: any) {
    const incomplete = e?.status === 400 || e?.data?.error === 'incomplete'
    toast.error(t(incomplete ? 'kcs.opsCreator.toast.incomplete' : 'kcs.opsCreator.toast.failed'))
    pending.value = null
  } finally {
    acting.value = false
  }
}

async function save() {
  if (!form.displayName.trim()) return
  saving.value = true
  try {
    await request(apiPath(API.opsCreatorPatch, { id: String(route.params.id) }), {
      method: 'PATCH',
      body: JSON.stringify({
        displayName: form.displayName.trim(),
        followers: form.followersUnknown || form.followers == null || (form.followers as unknown) === '' ? undefined : Number(form.followers),
        followersUnknown: form.followersUnknown,
        regions: splitList(form.regions),
        verticals: splitList(form.verticals),
        categories: form.categories,
        note: form.note.trim(),
      }),
    })
    toast.success(t('kcs.opsCreator.toast.saved'))
    await load()
  } catch {
    toast.error(t('kcs.opsCreator.toast.failed'))
  } finally {
    saving.value = false
  }
}

async function openRaw() {
  rawOpen.value = true
  if (rawLoaded) return
  rawLoading.value = true
  try {
    const res = await request<{ items?: RawRecord[] } & RawRecord>(apiPath(API.ingestRaw, { creatorId: String(route.params.id) }))
    rawItems.value = res.items ?? [res]
    rawLoaded = true
  } catch (e: any) {
    rawItems.value = []
    if (e?.status === 404) rawLoaded = true
    else toast.error(t('kcs.opsCreator.toast.failed'))
  } finally {
    rawLoading.value = false
  }
}

/** 原始内容里一眼能读的顶层字段（文字 / 数字 / 布尔），其余留在展开里。 */
function scalarFields(payload: unknown): [string, string][] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  return Object.entries(payload as Record<string, unknown>)
    .filter(([, v]) => v != null && ['string', 'number', 'boolean'].includes(typeof v))
    .slice(0, 12)
    .map(([k, v]) => [k, String(v)])
}
function pretty(payload: unknown) {
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}
function formatDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

onMounted(async () => {
  if (route.query.created) {
    toast.success(t('kcs.opsCreator.toast.created'))
  }
  try {
    await load()
  } catch {
    creator.value = null
  } finally {
    loading.value = false
  }
  if (!creator.value) {
    loadingHistory.value = false
    return
  }
  loadHistory()
  request<{ items: CategoryView[] }>(API.opsCategories.path)
    .then((res) => {
      categories.value = (res.items ?? []).filter((c) => c.enabled)
    })
    .catch(() => {})
})
</script>
