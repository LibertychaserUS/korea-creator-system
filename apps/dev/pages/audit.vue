<template>
  <PanelPage
    :testid="SCREEN_TESTID['B-audit']"
    :title="t('kcs.console.audit.title')"
    :eyebrow="t('kcs.nav.monitor')"
    :lead="t('kcs.console.audit.lead')"
  >
    <form class="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end" data-testid="audit-filters" @submit.prevent="apply">
      <div class="relative lg:w-72">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          v-model="q"
          type="search"
          class="h-9 pl-8"
          :placeholder="t('kcs.console.audit.search')"
          :aria-label="t('kcs.console.audit.search')"
          data-testid="audit-search"
        />
      </div>
      <div class="relative lg:w-56">
        <select
          v-model="action"
          :aria-label="t('kcs.console.audit.action')"
          data-testid="audit-action"
          class="border-input h-9 w-full appearance-none rounded-md border bg-transparent pl-3 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">{{ t('kcs.console.audit.actionAll') }}</option>
          <option v-for="a in actions" :key="a.action" :value="a.action">{{ actionLabel(a.action) }} ({{ formatNumber(a.n) }})</option>
        </select>
        <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">
        {{ t('kcs.console.audit.from') }}
        <Input v-model="from" type="date" class="h-9 lg:w-40" data-testid="audit-from" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">
        {{ t('kcs.console.audit.to') }}
        <Input v-model="to" type="date" class="h-9 lg:w-40" data-testid="audit-to" />
      </label>
      <div class="flex gap-2">
        <Button type="submit" size="sm" class="h-9" data-testid="audit-apply">
          <Filter class="size-4" aria-hidden="true" />
          {{ t('kcs.console.audit.apply') }}
        </Button>
        <Button v-if="filtered" type="button" size="sm" variant="ghost" class="h-9" data-testid="audit-clear" @click="clear">
          {{ t('kcs.console.audit.clear') }}
        </Button>
      </div>
    </form>

    <Alert v-if="error" variant="destructive" data-testid="audit-error">
      <AlertTriangle class="size-4" aria-hidden="true" />
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <TableCard :title="t('kcs.console.audit.title')" testid="table-audit">
      <template #meta>
        <span class="tabular-nums" data-testid="audit-total">{{ t('kcs.console.audit.count', { n: formatNumber(total) }) }}</span>
      </template>
      <Table class="hidden md:table">
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-36">{{ t('kcs.console.audit.cols.time') }}</TableHead>
            <TableHead class="w-40">{{ t('kcs.console.audit.cols.actor') }}</TableHead>
            <TableHead class="w-48">{{ t('kcs.console.audit.cols.action') }}</TableHead>
            <TableHead class="w-44">{{ t('kcs.console.audit.cols.target') }}</TableHead>
            <TableHead>{{ t('kcs.console.audit.cols.summary') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading && !items.length">
            <TableRow v-for="i in 8" :key="`sk-${i}`" class="hover:bg-transparent">
              <TableCell v-for="j in 5" :key="j"><Skeleton class="h-4 w-24" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-for="row in items" :key="row.id" :data-audit-id="row.id" :data-action="row.action">
            <TableCell class="text-xs tabular-nums text-muted-foreground">{{ formatDateTime(row.createdAt) }}</TableCell>
            <TableCell>
              <span class="block truncate text-sm text-foreground" :title="row.actorEmail ?? undefined">{{ actorLabel(row) }}</span>
            </TableCell>
            <TableCell class="text-sm font-medium text-foreground">{{ actionLabel(row.action) }}</TableCell>
            <TableCell class="text-xs text-muted-foreground">
              <span class="text-foreground">{{ entityLabel(row.entityType) }}</span>
              <span v-if="row.entityId" class="ml-1 font-mono" :title="row.entityId">{{ shortId(row.entityId) }}</span>
            </TableCell>
            <TableCell class="max-w-md truncate text-xs text-muted-foreground" :title="row.summary">{{ row.summary }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <ul class="divide-y divide-border/60 md:hidden">
        <li v-for="row in items" :key="row.id" class="space-y-1 px-4 py-3" :data-audit-id="row.id">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-sm font-medium text-foreground">{{ actionLabel(row.action) }}</span>
            <span class="shrink-0 text-[11px] tabular-nums text-muted-foreground">{{ formatDateTime(row.createdAt) }}</span>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ actorLabel(row) }} · {{ entityLabel(row.entityType) }}
            <span v-if="row.entityId" class="font-mono">{{ shortId(row.entityId) }}</span>
          </p>
          <p v-if="row.summary" class="truncate text-xs text-muted-foreground" :title="row.summary">{{ row.summary }}</p>
        </li>
      </ul>

      <EmptyState v-if="!loading && !items.length" :title="t('kcs.console.audit.empty')" :icon="ScrollText" />
      <template v-if="pages > 1" #footer>
        <ListPager
          v-model:page="page"
          :pages="pages"
          :info="t('kcs.console.audit.pageInfo', { page, pages, total })"
          :prev-label="t('kcs.console.audit.prev')"
          :next-label="t('kcs.console.audit.next')"
          testid="audit-pager"
        />
      </template>
    </TableCard>
  </PanelPage>
</template>

<script setup lang="ts">
import { AlertTriangle, ChevronDown, Filter, ScrollText, Search } from 'lucide-vue-next'
import { API, apiPath, SCREEN_TESTID, type AuditEntryView, type DevAuditPage } from '@kcs/contract'

const PAGE_SIZE = 50

const { t, te } = useI18n()
const { request } = useApi()
const { formatNumber, formatDateTime } = useFormat()

const q = ref('')
const action = ref('')
const from = ref('')
const to = ref('')
const page = ref(1)
const items = ref<AuditEntryView[]>([])
const actions = ref<DevAuditPage['actions']>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')

const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const filtered = computed(() => Boolean(q.value || action.value || from.value || to.value))

function actionLabel(value: string): string {
  const key = `kcs.console.audit.actions.${value.replace(/\./g, '_')}`
  return te(key) ? t(key) : value
}

function entityLabel(value: string): string {
  const key = `kcs.console.audit.entities.${value}`
  return te(key) ? t(key) : value
}

function actorLabel(row: AuditEntryView): string {
  if (!row.actorId) return t('kcs.console.audit.system')
  return row.actorName || row.actorEmail || row.actorId
}

const shortId = (id: string) => (id.length > 14 ? `${id.slice(0, 12)}…` : id)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await request<DevAuditPage>(
      apiPath(API.devAudit, {}, {
        page: page.value,
        pageSize: PAGE_SIZE,
        q: q.value.trim() || undefined,
        action: action.value || undefined,
        from: from.value || undefined,
        to: to.value || undefined,
      }),
    )
    items.value = res.items
    actions.value = res.actions
    total.value = res.total
  } catch (e: any) {
    items.value = []
    total.value = 0
    const detail = `${e?.message ?? ''} ${JSON.stringify(e?.data ?? '')}`
    error.value = /invalid_(from|to)/.test(detail) ? t('kcs.console.audit.badDate') : t('kcs.panel.error')
  } finally {
    loading.value = false
  }
}

function apply() {
  if (page.value !== 1) page.value = 1
  else load()
}

function clear() {
  q.value = ''
  action.value = ''
  from.value = ''
  to.value = ''
  apply()
}

watch(action, apply)
watch(page, load)
onMounted(load)
</script>
