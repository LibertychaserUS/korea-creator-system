<template>
  <PanelPage
    :testid="SCREEN_TESTID['A-ai-queue']"
    :title="t('kcs.opsReview.title')"
    :eyebrow="t('kcs.nav.ops')"
    :lead="t('kcs.opsReview.lead')"
  >
    <p v-if="!canWrite && !loading" class="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{{ t('kcs.opsReview.readOnly') }}</p>

    <TableCard :title="t('kcs.opsReview.title')" testid="table-review">
      <template #meta>
        <span class="tabular-nums">{{ t('kcs.opsReview.count', { n: formatNumber(items.length) }) }}</span>
      </template>
      <template v-if="canWrite && selected.size" #actions>
        <Button size="sm" :disabled="passing.size > 0" data-testid="btn-review-pass-selected" @click="passSelected">
          <Loader2 v-if="passing.size > 0" class="size-4 animate-spin" aria-hidden="true" />
          <CheckCheck v-else class="size-4" aria-hidden="true" />
          {{ t('kcs.opsReview.passSelected', { n: selected.size }) }}
        </Button>
        <Button size="sm" variant="ghost" :disabled="passing.size > 0" @click="selected = new Set()">
          {{ t('kcs.opsReview.clearSelected') }}
        </Button>
      </template>

      <Table class="hidden md:table">
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead v-if="canWrite" class="w-10">
              <span class="sr-only">{{ t('kcs.opsReview.selectAll') }}</span>
              <input
                type="checkbox"
                class="accent-primary"
                :checked="allSelected"
                :aria-label="t('kcs.opsReview.selectAll')"
                data-testid="review-select-all"
                @change="toggleAll"
              >
            </TableHead>
            <TableHead>{{ t('kcs.opsReview.cols.creator') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.opsReview.cols.followers') }}</TableHead>
            <TableHead class="hidden lg:table-cell">{{ t('kcs.opsReview.cols.verticals') }}</TableHead>
            <TableHead>{{ t('kcs.opsReview.cols.source') }}</TableHead>
            <TableHead class="w-36">{{ t('kcs.opsReview.cols.added') }}</TableHead>
            <TableHead v-if="canWrite" class="w-28">{{ t('kcs.opsReview.cols.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading && !items.length">
            <TableRow v-for="i in 4" :key="`sk-${i}`" class="hover:bg-transparent">
              <TableCell v-if="canWrite"><Skeleton class="h-4 w-4" /></TableCell>
              <TableCell><Skeleton class="h-4 w-40" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-12" /></TableCell>
              <TableCell class="hidden lg:table-cell"><Skeleton class="h-4 w-32" /></TableCell>
              <TableCell><Skeleton class="h-5 w-16" /></TableCell>
              <TableCell><Skeleton class="h-4 w-24" /></TableCell>
              <TableCell v-if="canWrite" />
            </TableRow>
          </template>
          <TableRow v-for="row in items" :key="row.id" data-testid="row-review" :data-creator-id="row.id">
            <TableCell v-if="canWrite">
              <input
                type="checkbox"
                class="accent-primary"
                :checked="selected.has(row.id)"
                :aria-label="t('kcs.opsReview.select', { name: row.displayName })"
                :data-testid="`review-select-${row.id}`"
                @change="toggleOne(row.id)"
              >
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-3">
                <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary" aria-hidden="true">
                  {{ (row.displayName || '?').trim().charAt(0).toUpperCase() }}
                </span>
                <NuxtLink :to="detailPath(row)" class="block max-w-56 truncate font-medium text-foreground hover:underline" data-testid="link-review-detail">
                  {{ row.displayName || t('kcs.panel.untitled') }}
                </NuxtLink>
              </div>
            </TableCell>
            <TableCell class="text-right tabular-nums">{{ row.followers == null ? '—' : formatNumber(row.followers) }}</TableCell>
            <TableCell class="hidden max-w-56 truncate text-muted-foreground lg:table-cell">{{ verticalsText(row) || '—' }}</TableCell>
            <TableCell>
              <SourceBadge v-if="row.source" :source="row.source" />
              <span v-else class="text-xs text-muted-foreground">{{ t('kcs.opsCreators.manual') }}</span>
            </TableCell>
            <TableCell class="text-xs tabular-nums text-muted-foreground">{{ formatDateTime(row.createdAt) }}</TableCell>
            <TableCell v-if="canWrite">
              <Button
                size="sm"
                variant="outline"
                class="h-8"
                :disabled="passing.has(row.id)"
                :data-testid="`btn-review-pass-${row.id}`"
                @click="pass(row)"
              >
                <Loader2 v-if="passing.has(row.id)" class="size-3.5 animate-spin" aria-hidden="true" />
                <Check v-else class="size-3.5" aria-hidden="true" />
                {{ t('kcs.opsReview.pass') }}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- 手机：卡片列表 -->
      <ul class="divide-y divide-border/60 md:hidden">
        <li v-for="row in items" :key="row.id" class="space-y-1.5 px-4 py-3" :data-creator-id="row.id">
          <div class="flex items-start justify-between gap-2">
            <NuxtLink :to="detailPath(row)" class="min-w-0 truncate text-sm font-medium text-foreground">
              {{ row.displayName || t('kcs.panel.untitled') }}
            </NuxtLink>
            <SourceBadge v-if="row.source" :source="row.source" />
            <span v-else class="shrink-0 text-[11px] text-muted-foreground">{{ t('kcs.opsCreators.manual') }}</span>
          </div>
          <p class="text-xs tabular-nums text-muted-foreground">
            {{ t('kcs.opsReview.cols.followers') }} {{ row.followers == null ? '—' : formatNumber(row.followers) }}
            <template v-if="verticalsText(row)"> · {{ verticalsText(row) }}</template>
          </p>
          <p class="text-[11px] tabular-nums text-muted-foreground">{{ formatDateTime(row.createdAt) }}</p>
          <div v-if="canWrite" class="flex gap-2 pt-1">
            <Button size="sm" variant="outline" class="h-8" :disabled="passing.has(row.id)" @click="pass(row)">
              <Loader2 v-if="passing.has(row.id)" class="size-3.5 animate-spin" aria-hidden="true" />
              <Check v-else class="size-3.5" aria-hidden="true" />
              {{ t('kcs.opsReview.pass') }}
            </Button>
            <Button as-child size="sm" variant="ghost" class="h-8">
              <NuxtLink :to="detailPath(row)">{{ t('kcs.opsReview.open') }}</NuxtLink>
            </Button>
          </div>
        </li>
      </ul>

      <EmptyState v-if="!loading && !loadError && !items.length" :title="t('kcs.opsReview.empty')" :body="t('kcs.opsReview.emptyBody')" :icon="ClipboardCheck">
        <Button as-child size="sm" variant="outline">
          <NuxtLink :to="localePath('/creators')">{{ t('kcs.opsCreators.title') }}</NuxtLink>
        </Button>
      </EmptyState>
      <div v-else-if="loadError && !loading" class="flex flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-5" role="alert" data-testid="review-error">
        <p class="text-sm text-muted-foreground">{{ t('kcs.states.error') }}</p>
        <Button variant="outline" size="sm" data-testid="btn-review-retry" @click="load()">{{ t('kcs.panel.retry') }}</Button>
      </div>
    </TableCard>
  </PanelPage>
</template>

<script setup lang="ts">
import { Check, CheckCheck, ClipboardCheck, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { API, SCREEN_TESTID, apiPath, can, type ReviewView } from '@kcs/contract'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { request, errorText } = useApi()
const { formatNumber, formatDateTime } = useFormat()
const { user } = useSession()

const canWrite = computed(() => Boolean(user.value && can(user.value.role, 'ops.write')))

const items = ref<ReviewView[]>([])
const loading = ref(true)
const loadError = ref(false)
/** 勾选的行（批量通过）。 */
const selected = ref<Set<string>>(new Set())
/** 正在通过的行（单个或批量进行中），禁用对应按钮。 */
const passing = ref<Set<string>>(new Set())

const allSelected = computed(() => items.value.length > 0 && selected.value.size === items.value.length)

function detailPath(row: ReviewView) {
  return localePath(`/creators/${row.id}`)
}

function verticalsText(row: ReviewView) {
  const list = Array.isArray(row.verticals) ? row.verticals : []
  const sep = locale.value === 'zh-CN' ? '、' : ', '
  return list.join(sep)
}

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(items.value.map((row) => row.id))
}

function toggleOne(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function dropRows(ids: Iterable<string>) {
  const gone = new Set(ids)
  items.value = items.value.filter((row) => !gone.has(row.id))
  const next = new Set(selected.value)
  for (const id of gone) next.delete(id)
  selected.value = next
}

async function load() {
  loading.value = true
  try {
    const res = await request<{ items: ReviewView[] }>(API.opsReview.path)
    items.value = res.items ?? []
    loadError.value = false
    selected.value = new Set()
  } catch {
    items.value = []
    loadError.value = true
  } finally {
    loading.value = false
  }
}

/** 通过一位：后端把 needsReview 清掉、状态推进到 ready，行就地移除。 */
async function pass(row: ReviewView) {
  passing.value = new Set([...passing.value, row.id])
  try {
    await request(apiPath(API.opsReviewPass, { id: row.id }), { method: 'POST' })
    dropRows([row.id])
    toast.success(t('kcs.opsReview.passed', { name: row.displayName }))
  } catch (e: unknown) {
    toast.error(errorText(e))
  } finally {
    const next = new Set(passing.value)
    next.delete(row.id)
    passing.value = next
  }
}

async function passSelected() {
  const ids = [...selected.value]
  passing.value = new Set(ids)
  let failed = 0
  const done: string[] = []
  try {
    for (const id of ids) {
      try {
        await request(apiPath(API.opsReviewPass, { id }), { method: 'POST' })
        done.push(id)
      } catch {
        failed++
      }
    }
    dropRows(done)
    if (done.length) toast.success(t('kcs.opsReview.passedN', { n: formatNumber(done.length) }))
    if (failed) toast.error(t('kcs.opsReview.failed'))
  } finally {
    passing.value = new Set()
  }
}

onMounted(load)
</script>
