<template>
  <PanelPage
    :testid="SCREEN_TESTID['C-shortlist']"
    :title="t('kcs.console.shortlist.title')"
    :eyebrow="t('kcs.nav.select')"
    :lead="t('kcs.console.shortlist.lead')"
  >
    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <TableCard :title="t('kcs.console.shortlist.title')" testid="table-shortlist">
        <template #meta>
          <span class="tabular-nums" data-testid="shortlist-count">{{ t('kcs.console.shortlist.count', { n: formatNumber(items.length) }) }}</span>
        </template>
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead class="w-10">
                <input
                  type="checkbox"
                  class="size-4 accent-primary align-middle"
                  :checked="allSelected"
                  :indeterminate="someSelected"
                  :disabled="!items.length"
                  :aria-label="t('kcs.console.shortlist.selectAll')"
                  data-testid="shortlist-select-all"
                  @change="toggleAll"
                >
              </TableHead>
              <TableHead>{{ t('kcs.console.shortlist.cols.creator') }}</TableHead>
              <TableHead class="hidden w-24 sm:table-cell">{{ t('kcs.console.shortlist.cols.tier') }}</TableHead>
              <TableHead class="hidden w-24 md:table-cell">{{ t('kcs.console.shortlist.cols.health') }}</TableHead>
              <TableHead class="text-right">{{ t('kcs.console.shortlist.cols.followers') }}</TableHead>
              <TableHead class="hidden text-right sm:table-cell">{{ t('kcs.console.shortlist.cols.price') }}</TableHead>
              <TableHead class="hidden w-32 2xl:table-cell">{{ t('kcs.console.shortlist.cols.added') }}</TableHead>
              <TableHead v-if="canWrite" class="w-12"><span class="sr-only">{{ t('kcs.console.shortlist.cols.actions') }}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="loading && !items.length">
              <TableRow v-for="i in 4" :key="`sk-${i}`" class="hover:bg-transparent">
                <TableCell><Skeleton class="size-4" /></TableCell>
                <TableCell><Skeleton class="h-4 w-36" /></TableCell>
                <TableCell class="hidden sm:table-cell"><Skeleton class="h-5 w-12" /></TableCell>
                <TableCell class="hidden md:table-cell"><Skeleton class="h-5 w-12" /></TableCell>
                <TableCell><Skeleton class="ml-auto h-4 w-14" /></TableCell>
                <TableCell class="hidden sm:table-cell"><Skeleton class="ml-auto h-4 w-16" /></TableCell>
                <TableCell class="hidden 2xl:table-cell"><Skeleton class="h-4 w-20" /></TableCell>
                <TableCell v-if="canWrite" />
              </TableRow>
            </template>
            <TableRow v-for="row in items" :key="row.creatorId" data-testid="row-shortlist" :data-creator-id="row.creatorId" :data-creator-key="row.creatorKey">
              <TableCell>
                <input
                  v-model="selected"
                  type="checkbox"
                  class="size-4 accent-primary align-middle"
                  :value="row.creatorId"
                  :aria-label="t('kcs.console.shortlist.selectLabel', { name: row.displayName })"
                >
              </TableCell>
              <TableCell>
                <div class="flex min-w-0 max-w-[9rem] items-center gap-3 sm:max-w-56">
                  <Avatar class="hidden size-8 shrink-0 border border-border sm:flex">
                    <AvatarFallback class="bg-muted text-xs text-muted-foreground">{{ row.displayName?.charAt(0) }}</AvatarFallback>
                  </Avatar>
                  <NuxtLink
                    :to="localePath(`/creators/${row.id}`)"
                    class="min-w-0 truncate font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline"
                    :aria-label="t('kcs.console.shortlist.open', { name: row.displayName })"
                  >
                    {{ row.displayName }}
                  </NuxtLink>
                </div>
              </TableCell>
              <TableCell class="hidden sm:table-cell"><TierBadge :tier="row.tier" /></TableCell>
              <TableCell class="hidden md:table-cell"><HealthBadge :health="row.metrics?.health ?? row.health" :low-active="row.metrics?.lowActive" /></TableCell>
              <TableCell class="text-right tabular-nums">{{ row.followersUnknown ? '—' : formatNumber(row.followers) }}</TableCell>
              <TableCell class="hidden text-right tabular-nums sm:table-cell">{{ formatPrice(row.price?.amountMin, row.price?.currency) }}</TableCell>
              <TableCell class="hidden text-xs tabular-nums text-muted-foreground 2xl:table-cell">{{ formatDateTime(row.addedAt) }}</TableCell>
              <TableCell v-if="canWrite" class="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 text-muted-foreground hover:text-destructive"
                  :disabled="removing === row.creatorId"
                  :aria-label="t('kcs.console.shortlist.removeLabel', { name: row.displayName })"
                  :title="t('kcs.console.shortlist.remove')"
                  data-testid="btn-shortlist-remove"
                  @click="remove(row)"
                >
                  <Loader2 v-if="removing === row.creatorId" class="size-4 animate-spin" aria-hidden="true" />
                  <UserMinus v-else class="size-4" aria-hidden="true" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <EmptyState v-if="!loading && !items.length" :title="t('kcs.console.shortlist.empty')" :body="t('kcs.console.shortlist.emptyHint')" :icon="ListChecks">
          <Button as-child size="sm" variant="outline">
            <NuxtLink :to="localePath('/')">{{ t('kcs.panel.pool') }}</NuxtLink>
          </Button>
        </EmptyState>
        <template v-if="items.length" #footer>
          <p class="text-xs text-muted-foreground">{{ t('kcs.console.shortlist.order') }}</p>
        </template>
      </TableCard>

      <aside class="grid content-start gap-4" data-testid="shortlist-side">
        <Card class="gap-0 border-border/60 py-0 shadow-xs">
          <div class="px-5 py-4">
            <p class="text-xs text-muted-foreground">{{ t('kcs.console.shortlist.quoteTitle') }} · {{ t('kcs.console.shortlist.selected', { n: formatNumber(selected.length) }) }}</p>
            <p class="mt-1 text-3xl font-semibold tabular-nums tracking-tight" data-testid="shortlist-quote">{{ formatPrice(quote.total, 'CNY') }}</p>
            <p class="mt-1 text-[11px] leading-snug text-muted-foreground">{{ t('kcs.console.shortlist.quoteNote') }}</p>
            <p v-if="quote.missing" class="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{{ t('kcs.display.quoteMissing', { n: quote.missing }) }}</p>
          </div>
        </Card>

        <Card v-if="canAssign" class="gap-0 border-border/60 py-0 shadow-xs">
          <form class="grid gap-3 px-5 py-4" data-testid="form-shortlist-assign" @submit.prevent="assign">
            <h2 class="text-sm font-semibold">{{ t('kcs.console.shortlist.assignTitle') }}</h2>
            <template v-if="projects.length">
              <Label for="shortlist-project" class="sr-only">{{ t('kcs.console.shortlist.project') }}</Label>
              <div class="relative">
                <select
                  id="shortlist-project"
                  v-model="projectId"
                  data-testid="shortlist-project"
                  class="border-input h-9 w-full appearance-none rounded-md border bg-transparent pl-3 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  <option value="" disabled>{{ t('kcs.console.shortlist.projectPlaceholder') }}</option>
                  <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              </div>
              <Button type="submit" :disabled="!projectId || !selected.length || assigning" data-testid="btn-shortlist-assign">
                <Loader2 v-if="assigning" class="size-4 animate-spin" aria-hidden="true" />
                <FolderInput v-else class="size-4" aria-hidden="true" />
                {{ assigning ? t('kcs.console.shortlist.assigning') : t('kcs.console.shortlist.assign') }}
              </Button>
            </template>
            <template v-else>
              <p class="text-xs text-muted-foreground">{{ t('kcs.console.shortlist.noProjects') }}</p>
              <Button as-child variant="outline" size="sm">
                <NuxtLink :to="localePath('/projects/new')">
                  <Plus class="size-4" aria-hidden="true" />
                  {{ t('kcs.console.shortlist.newProject') }}
                </NuxtLink>
              </Button>
            </template>
            <p v-if="assignError" role="alert" class="text-xs text-destructive" data-testid="shortlist-assign-error">{{ assignError }}</p>
          </form>
        </Card>
      </aside>
    </div>
  </PanelPage>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import { ChevronDown, FolderInput, ListChecks, Loader2, Plus, UserMinus } from 'lucide-vue-next'
import { API, apiPath, can, SCREEN_TESTID, type ProjectView } from '@kcs/contract'

const { t } = useI18n()
const localePath = useLocalePath()
const { request } = useApi()
const { user } = useSession()
const { formatNumber, formatDateTime } = useFormat()
const { formatPrice, sumCny } = useCurrency()

const items = ref<any[]>([])
const projects = ref<ProjectView[]>([])
const selected = ref<string[]>([])
const projectId = ref('')
const loading = ref(true)
const removing = ref<string | null>(null)
const assigning = ref(false)
const assignError = ref('')

const canWrite = computed(() => Boolean(user.value && can(user.value.role, 'select.write')))
const canAssign = computed(() => Boolean(user.value && can(user.value.role, 'select.assign')))
const allSelected = computed(() => items.value.length > 0 && selected.value.length === items.value.length)
const someSelected = computed(() => selected.value.length > 0 && !allSelected.value)
const chosen = computed(() => items.value.filter((row) => selected.value.includes(row.creatorId)))
const quote = computed(() =>
  sumCny(chosen.value.map((r) => ({ amount: r.price?.amountMin, currency: r.price?.currency, fxToCny: r.price?.fxToCny }))),
)

function toggleAll() {
  selected.value = allSelected.value ? [] : items.value.map((row) => row.creatorId)
}

async function load() {
  const res = await request<{ items: any[] }>(API.shortlist.path)
  items.value = res.items ?? []
  const present = new Set(items.value.map((row) => row.creatorId))
  selected.value = selected.value.filter((id) => present.has(id))
}

async function loadProjects() {
  if (!canAssign.value) return
  projects.value = (await request<{ items: ProjectView[] }>(API.projects.path).catch(() => ({ items: [] }))).items ?? []
  if (projects.value.length === 1) projectId.value = projects.value[0]!.id
}

async function remove(row: any) {
  removing.value = row.creatorId
  try {
    await request(apiPath(API.shortlistRemove, { creatorId: row.creatorId }), { method: 'DELETE' })
    toast.success(t('kcs.console.shortlist.removed', { name: row.displayName }))
    await load()
  } catch {
    toast.error(t('kcs.console.shortlist.failed'))
  } finally {
    removing.value = null
  }
}

async function assign() {
  const project = projects.value.find((p) => p.id === projectId.value)
  if (!project || !selected.value.length) return
  assigning.value = true
  assignError.value = ''
  try {
    await request(apiPath(API.assign, { id: project.id }), {
      method: 'POST',
      body: JSON.stringify({ creatorIds: selected.value }),
    })
    toast.success(t('kcs.console.shortlist.assigned', { n: selected.value.length, project: project.name }))
  } catch (e: any) {
    assignError.value = e?.message === 'not_in_pool' ? t('kcs.console.shortlist.notInPool') : t('kcs.console.shortlist.failed')
  } finally {
    assigning.value = false
  }
}

onMounted(async () => {
  try {
    await load()
    selected.value = items.value.map((row) => row.creatorId)
  } finally {
    loading.value = false
  }
  loadProjects()
})
</script>
