<template>
  <PanelPage :testid="TESTID.screenOpsCreators" :title="t('kcs.opsCreators.title')" :eyebrow="t('kcs.nav.ops')" :lead="t('kcs.opsCreators.lead')">
    <template #actions>
      <Button as-child>
        <NuxtLink :data-testid="TESTID.btnCreateCreator" :to="localePath('/creators/new')">
          <UserPlus class="size-4" />
          {{ t('kcs.panel.createCreator') }}
        </NuxtLink>
      </Button>
    </template>

    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div class="inline-flex w-full rounded-lg border border-border bg-muted/40 p-0.5 sm:w-auto" role="tablist" :aria-label="t('kcs.opsCreators.cols.status')">
        <button
          v-for="tab in tabs"
          :key="tab.stage"
          type="button"
          role="tab"
          class="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[6px] px-3 text-xs font-medium transition-colors sm:flex-none"
          :class="stage === tab.stage ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
          :aria-selected="stage === tab.stage"
          :data-testid="tab.testid"
          @click="setStage(tab.stage)"
        >
          {{ t(`kcs.opsCreators.tabs.${tab.stage}`) }}
          <span class="rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">{{ formatNumber(counts[tab.stage]) }}</span>
        </button>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row">
        <div class="relative sm:w-72">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="q"
            type="search"
            class="h-9 pl-8"
            :placeholder="t('kcs.opsCreators.search')"
            :aria-label="t('kcs.opsCreators.search')"
            :data-testid="TESTID.opsCreatorSearch"
          />
        </div>
        <div class="relative sm:w-40">
          <select
            v-model="source"
            :aria-label="t('kcs.opsCreators.cols.source')"
            :data-testid="TESTID.opsCreatorSource"
            class="border-input h-9 w-full appearance-none rounded-md border bg-transparent pl-3 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="">{{ t('kcs.opsCreators.sourceAll') }}</option>
            <option v-for="id in SOURCE_IDS" :key="id" :value="id">{{ t(`kcs.source.${id}`) }}</option>
            <option value="manual">{{ t('kcs.opsCreators.manual') }}</option>
          </select>
          <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
    </div>

    <div class="hidden md:block">
      <TableCard>
        <Table :data-testid="TESTID.tableOpsCreators">
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead>{{ t('kcs.opsCreators.cols.creator') }}</TableHead>
              <TableHead>{{ t('kcs.opsCreators.cols.source') }}</TableHead>
              <TableHead class="text-right">{{ t('kcs.opsCreators.cols.followers') }}</TableHead>
              <TableHead>{{ t('kcs.opsCreators.cols.tier') }}</TableHead>
              <TableHead class="hidden lg:table-cell">{{ t('kcs.opsCreators.cols.updated') }}</TableHead>
              <TableHead>{{ t('kcs.opsCreators.cols.status') }}</TableHead>
              <TableHead class="w-10"><span class="sr-only">{{ t('kcs.opsCreators.open') }}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="loading && !items.length">
              <TableRow v-for="i in 6" :key="`sk-${i}`" class="hover:bg-transparent">
                <TableCell><Skeleton class="h-4 w-40" /></TableCell>
                <TableCell><Skeleton class="h-5 w-16" /></TableCell>
                <TableCell><Skeleton class="ml-auto h-4 w-12" /></TableCell>
                <TableCell><Skeleton class="h-5 w-12" /></TableCell>
                <TableCell class="hidden lg:table-cell"><Skeleton class="h-4 w-24" /></TableCell>
                <TableCell><Skeleton class="h-5 w-16" /></TableCell>
                <TableCell />
              </TableRow>
            </template>
            <TableRow
              v-for="c in pageItems"
              :key="c.id"
              class="cursor-pointer"
              :data-testid="TESTID.rowOpsCreator"
              :data-creator-id="c.id"
              @click="open(c)"
            >
              <TableCell>
                <div class="flex items-center gap-3">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary" aria-hidden="true">
                    {{ initialOf(c) }}
                  </span>
                  <div class="min-w-0">
                    <NuxtLink :to="detailPath(c)" class="block max-w-64 truncate font-medium text-foreground hover:underline" @click.stop>
                      {{ c.displayName || t('kcs.panel.untitled') }}
                    </NuxtLink>
                    <span v-if="c.xhsId" class="block truncate text-[11px] text-muted-foreground">{{ t('kcs.panel.xhsId') }} {{ c.xhsId }}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <SourceBadge v-if="c.source" :source="c.source" />
                <span v-else class="text-xs text-muted-foreground">{{ t('kcs.opsCreators.manual') }}</span>
              </TableCell>
              <TableCell class="text-right tabular-nums">{{ followersText(c) }}</TableCell>
              <TableCell><TierBadge :tier="tierOf(followersOf(c))" /></TableCell>
              <TableCell class="hidden text-xs tabular-nums text-muted-foreground lg:table-cell">{{ formatDate(c.updatedAt) }}</TableCell>
              <TableCell>
                <div class="flex flex-wrap items-center gap-1.5">
                  <StatusBadge kind="stage" :status="c.stage" />
                  <span v-if="c.needsReview && c.stage !== 'review'" class="text-[11px] text-amber-700 dark:text-amber-300">{{ t('kcs.opsCreators.needsReview') }}</span>
                </div>
              </TableCell>
              <TableCell class="text-right"><ChevronRight class="size-4 text-muted-foreground" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <EmptyState v-if="!loading && !items.length" :title="emptyTitle" :body="emptyBody" :icon="Users" />
        <template v-if="pages > 1" #footer>
          <ListPager
            v-model:page="page"
            :pages="pages"
            :info="t('kcs.opsCreators.pageInfo', { page, pages, total })"
            :prev-label="t('kcs.opsCreators.prev')"
            :next-label="t('kcs.opsCreators.next')"
            :testid="TESTID.opsCreatorsPager"
          />
        </template>
      </TableCard>
    </div>

    <!-- 手机：卡片列表 -->
    <div class="flex flex-col gap-3 md:hidden">
      <template v-if="loading && !items.length">
        <Skeleton v-for="i in 4" :key="`msk-${i}`" class="h-24 rounded-xl" />
      </template>
      <NuxtLink
        v-for="c in pageItems"
        :key="c.id"
        :to="detailPath(c)"
        class="block rounded-xl border border-border/60 bg-card p-4 shadow-xs transition-colors hover:border-primary/30"
        :data-testid="TESTID.cardOpsCreator"
        :data-creator-id="c.id"
      >
        <div class="flex items-start gap-3">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary" aria-hidden="true">
            {{ initialOf(c) }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="truncate font-medium text-foreground">{{ c.displayName || t('kcs.panel.untitled') }}</p>
              <StatusBadge kind="stage" :status="c.stage" class="shrink-0" />
            </div>
            <p v-if="c.xhsId" class="truncate text-[11px] text-muted-foreground">{{ t('kcs.panel.xhsId') }} {{ c.xhsId }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <SourceBadge v-if="c.source" :source="c.source" />
              <span v-else>{{ t('kcs.opsCreators.manual') }}</span>
              <TierBadge :tier="tierOf(followersOf(c))" />
              <span class="tabular-nums">{{ t('kcs.opsCreators.cols.followers') }} {{ followersText(c) }}</span>
            </div>
            <p class="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
              {{ t('kcs.opsCreators.cols.updated') }} {{ formatDate(c.updatedAt) }}
              <span v-if="c.needsReview && c.stage !== 'review'" class="text-amber-700 dark:text-amber-300"> · {{ t('kcs.opsCreators.needsReview') }}</span>
            </p>
          </div>
        </div>
      </NuxtLink>
      <EmptyState v-if="!loading && !items.length" :title="emptyTitle" :body="emptyBody" :icon="Users" />
      <ListPager
        v-if="pages > 1"
        v-model:page="page"
        :pages="pages"
        :info="t('kcs.opsCreators.pageInfo', { page, pages, total })"
        :prev-label="t('kcs.opsCreators.prev')"
        :next-label="t('kcs.opsCreators.next')"
        :testid="TESTID.opsCreatorsPager"
      />
    </div>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
  </PanelPage>
</template>

<script setup lang="ts">
import { ChevronDown, ChevronRight, Search, UserPlus, Users } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { SOURCE_IDS, TESTID, pageCount, tierOf, type CreatorStage } from '@kcs/contract'

type Row = {
  id: string
  displayName: string | null
  xhsId: string | null
  source: string | null
  followers: number | null
  followersUnknown?: boolean
  metrics?: { followers?: number | null } | null
  stage: CreatorStage
  needsReview?: boolean
  updatedAt: string | null
}

const PAGE_SIZE = 20

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const { request } = useApi()
const { formatNumber } = useFormat()

const tabs = [
  { stage: 'review' as const, testid: TESTID.opsCreatorTabReview },
  { stage: 'released' as const, testid: TESTID.opsCreatorTabReleased },
  { stage: 'withdrawn' as const, testid: TESTID.opsCreatorTabWithdrawn },
]
const isStage = (v: unknown): v is CreatorStage => v === 'review' || v === 'released' || v === 'withdrawn'

const items = ref<Row[]>([])
const total = ref(0)
const counts = ref<Record<CreatorStage, number>>({ review: 0, released: 0, withdrawn: 0 })
const loading = ref(true)
const error = ref('')
const stage = ref<CreatorStage>(isStage(route.query.tab) ? route.query.tab : 'review')
const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
const source = ref(typeof route.query.source === 'string' ? route.query.source : '')
const page = ref(Math.max(1, Number(route.query.page) || 1))

/** 搜索和来源先筛，标签页再分（服务端做）：标签上的数字跟着搜索变。 */
const pages = computed(() => pageCount(total.value, PAGE_SIZE))
const pageItems = computed(() => items.value)

const filtering = computed(() => Boolean(q.value.trim() || source.value))
const emptyTitle = computed(() => (filtering.value ? t('kcs.opsCreators.emptyFilter') : t(`kcs.opsCreators.empty.${stage.value}`)))
const emptyBody = computed(() => (filtering.value ? undefined : stage.value === 'review' ? t('kcs.opsCreators.emptyHint') : undefined))

let loadSeq = 0
async function load() {
  const mine = ++loadSeq
  loading.value = true
  try {
    const params = new URLSearchParams({ stage: stage.value, page: String(page.value), pageSize: String(PAGE_SIZE) })
    if (q.value.trim()) params.set('q', q.value.trim())
    if (source.value) params.set('source', source.value)
    const res = await request<{ items: Row[]; total: number; counts: Record<CreatorStage, number> }>(`/api/ops/creators?${params}`)
    if (mine !== loadSeq) return
    items.value = res.items ?? []
    total.value = res.total ?? 0
    counts.value = res.counts ?? counts.value
    error.value = ''
    if (page.value > pages.value) page.value = pages.value
  } catch {
    if (mine === loadSeq) error.value = t('kcs.panel.error')
  } finally {
    if (mine === loadSeq) loading.value = false
  }
}
const debouncedLoad = useDebounceFn(load, 250)

watch(q, () => {
  if (page.value !== 1) page.value = 1
  else debouncedLoad()
})
watch(source, () => {
  if (page.value !== 1) page.value = 1
  else load()
})
watch([stage, page], () => load())
watch([stage, q, source, page], () => {
  const query: Record<string, string> = { tab: stage.value }
  if (q.value.trim()) query.q = q.value.trim()
  if (source.value) query.source = source.value
  if (page.value > 1) query.page = String(page.value)
  router.replace({ query })
})

function setStage(next: CreatorStage) {
  stage.value = next
  page.value = 1
}

function followersOf(c: Row) {
  return c.metrics?.followers ?? c.followers ?? null
}
function followersText(c: Row) {
  const n = followersOf(c)
  return n == null ? '—' : formatNumber(n)
}
function initialOf(c: Row) {
  return (c.displayName || '?').trim().charAt(0).toUpperCase()
}
function detailPath(c: Row) {
  return localePath(`/creators/${c.id}`)
}
function open(c: Row) {
  navigateTo(detailPath(c))
}
function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

onMounted(load)
</script>
