<template>
  <PanelPage
    testid="screen-c-pool"
    :title="t('kcs.panel.pool')"
    :eyebrow="t('kcs.nav.select')"
    :lead="t('kcs.panel.poolLead')"
  >
    <template #actions>
      <Button v-if="projectId" as-child variant="outline" size="sm">
        <NuxtLink :to="localePath(`/projects/${projectId}`)">
          <ArrowLeft class="size-4" />
          {{ projectName || t('kcs.panel.back') }}
        </NuxtLink>
      </Button>
    </template>

    <!-- 项目上下文条：从项目页进来时提示正在为哪个项目挑人 -->
    <div
      v-if="projectId"
      class="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
      data-testid="pool-project-context"
    >
      <span class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
        <FolderKanban class="size-4" />
      </span>
      <span class="text-foreground">{{ t('kcs.panel.assignTo', { name: projectName || t('kcs.panel.untitled') }) }}</span>
      <span class="ml-auto tabular-nums text-muted-foreground">{{ t('kcs.panel.picked', { n: picked.length }) }}</span>
    </div>

    <!-- 筛选栏 -->
    <Card class="gap-0 border-border/60 py-0 shadow-xs">
      <div class="grid gap-4 p-4 sm:p-5 lg:grid-cols-[auto_auto_auto_1fr] lg:items-end">
        <fieldset data-testid="filter-followers" class="min-w-0">
          <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.panel.followersRange') }}</legend>
          <div class="flex items-center gap-2">
            <Input
              v-model="followersMin"
              data-testid="filter-followers-min"
              type="number"
              inputmode="numeric"
              min="0"
              class="h-9 w-full tabular-nums lg:w-28"
              :placeholder="t('kcs.panel.min')"
              :aria-label="`${t('kcs.panel.followersRange')} ${t('kcs.panel.min')}`"
            />
            <span class="text-muted-foreground/60">–</span>
            <Input
              v-model="followersMax"
              data-testid="filter-followers-max"
              type="number"
              inputmode="numeric"
              min="0"
              class="h-9 w-full tabular-nums lg:w-28"
              :placeholder="t('kcs.panel.max')"
              :aria-label="`${t('kcs.panel.followersRange')} ${t('kcs.panel.max')}`"
            />
          </div>
        </fieldset>

        <fieldset data-testid="filter-price" class="min-w-0">
          <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.panel.priceRange') }}</legend>
          <div class="flex items-center gap-2">
            <Input
              v-model="priceMin"
              data-testid="filter-price-min"
              type="number"
              inputmode="numeric"
              min="0"
              class="h-9 w-full tabular-nums lg:w-28"
              :placeholder="t('kcs.panel.min')"
              :aria-label="`${t('kcs.panel.priceRange')} ${t('kcs.panel.min')}`"
            />
            <span class="text-muted-foreground/60">–</span>
            <Input
              v-model="priceMax"
              data-testid="filter-price-max"
              type="number"
              inputmode="numeric"
              min="0"
              class="h-9 w-full tabular-nums lg:w-28"
              :placeholder="t('kcs.panel.max')"
              :aria-label="`${t('kcs.panel.priceRange')} ${t('kcs.panel.max')}`"
            />
          </div>
        </fieldset>

        <div class="min-w-0">
          <Label for="filter-collab" class="mb-1.5 block text-xs font-medium text-muted-foreground">
            {{ t('kcs.panel.collabFilter') }}
          </Label>
          <div class="relative">
            <select
              id="filter-collab"
              v-model="hasCollaborated"
              data-testid="filter-collab"
              class="border-input h-9 w-full appearance-none rounded-md border bg-transparent pl-3 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:w-36"
            >
              <option value="any">{{ t('kcs.panel.collabAny') }}</option>
              <option value="true">{{ t('kcs.panel.collabYes') }}</option>
              <option value="false">{{ t('kcs.panel.collabNo') }}</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div class="min-w-0 lg:justify-self-end">
          <span class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.panel.sort') }}</span>
          <div class="inline-flex flex-wrap rounded-md border border-border bg-muted/40 p-0.5" role="group" :aria-label="t('kcs.panel.sort')">
            <button
              v-for="opt in sortOptions"
              :key="opt.value"
              type="button"
              class="h-8 rounded-[6px] px-3 text-xs font-medium transition-colors"
              :class="sort === opt.value ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
              :aria-pressed="sort === opt.value"
              :data-testid="opt.testid"
              :title="t('kcs.panel.sortHint', { field: opt.label })"
              @click="applySort(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>
      <div v-if="hasFilter" class="flex items-center gap-2 border-t border-border/60 px-4 py-2 text-xs text-muted-foreground sm:px-5">
        <SlidersHorizontal class="size-3.5" />
        <span>{{ t('kcs.panel.filter') }} · {{ formatNumber(items.length) }}</span>
        <button type="button" class="ml-auto font-medium text-foreground underline-offset-4 hover:underline" @click="resetFilters">
          {{ t('kcs.panel.clearFilters') }}
        </button>
      </div>
    </Card>

    <!-- 达人表 -->
    <TableCard :title="t('kcs.panel.pool')">
      <template #meta>
        <span class="tabular-nums">{{ formatNumber(items.length) }} {{ t('kcs.creators.cols.creator') }}</span>
      </template>
      <!-- 手机：卡片列表（表格列太多，横向滚动会藏掉分数与等级） -->
      <ul class="divide-y divide-border/60 md:hidden">
        <template v-if="loading && !items.length">
          <li v-for="i in 4" :key="`msk-${i}`" class="flex items-start gap-3 px-4 py-3">
            <Skeleton class="size-9 rounded-full" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-32" />
              <Skeleton class="h-3 w-24" />
              <Skeleton class="h-8 w-full" />
            </div>
          </li>
        </template>
        <li
          v-for="row in items"
          :key="`m-${row.id}`"
          class="flex items-start gap-3 px-4 py-3 transition-colors data-[state=selected]:bg-primary/5"
          :class="canAssign ? 'cursor-pointer active:bg-muted/60' : ''"
          :data-state="picked.includes(row.id) ? 'selected' : undefined"
          @click="canAssign && toggle(row.id)"
        >
          <input
            v-if="canAssign"
            v-model="picked"
            type="checkbox"
            :value="row.id"
            :aria-label="row.displayName"
            class="mt-2.5 size-4 shrink-0 rounded border-input accent-primary"
            @click.stop
          />
          <Avatar class="size-9 border border-border">
            <AvatarFallback class="bg-muted text-xs text-muted-foreground">{{ row.displayName?.charAt(0) }}</AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <div class="flex min-w-0 items-center gap-2">
                <span class="truncate font-medium text-foreground">{{ row.displayName }}</span>
                <span v-if="row.rank" class="shrink-0 font-mono text-[11px] tabular-nums" :class="row.rank <= 3 ? 'text-primary' : 'text-muted-foreground'">#{{ row.rank }}</span>
              </div>
              <GradeBadge :grade="row.grade" />
            </div>
            <p class="truncate text-xs text-muted-foreground">
              <template v-if="row.verticals?.length">{{ row.verticals.slice(0, 3).join(' · ') }}</template>
              <template v-else-if="row.regions?.length">{{ row.regions.join(' · ') }}</template>
              <template v-else>{{ row.creatorKey }}</template>
            </p>
            <dl class="mt-2.5 grid grid-cols-3 gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
              <div>
                <dt class="text-muted-foreground">{{ t('kcs.creators.cols.score') }}</dt>
                <dd class="font-semibold tabular-nums text-foreground">{{ formatScore(row.final) }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">{{ t('kcs.creators.cols.fans') }}</dt>
                <dd class="font-semibold tabular-nums text-foreground">{{ row.followersUnknown ? '—' : formatNumber(row.followers, { notation: 'compact' }) }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">{{ t('kcs.panel.quote') }}</dt>
                <dd class="font-semibold tabular-nums text-foreground">{{ formatPrice(row.price?.amountMin, row.price?.currency) }}</dd>
              </div>
            </dl>
          </div>
        </li>
      </ul>

      <div class="hidden md:block">
      <Table data-testid="table-pool">
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead v-if="canAssign" class="w-10">
              <span class="sr-only">{{ t('kcs.panel.assign') }}</span>
            </TableHead>
            <TableHead class="w-16">{{ t('kcs.creators.cols.rank') }}</TableHead>
            <TableHead>{{ t('kcs.creators.cols.creator') }}</TableHead>
            <TableHead class="w-20">{{ t('kcs.creators.cols.grade') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.creators.cols.score') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.creators.cols.fans') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.panel.quote') }}</TableHead>
            <TableHead class="hidden text-right md:table-cell">{{ t('kcs.panel.collaborated') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading && !items.length">
            <TableRow v-for="i in 6" :key="`sk-${i}`" class="hover:bg-transparent">
              <TableCell v-if="canAssign"><Skeleton class="size-4" /></TableCell>
              <TableCell><Skeleton class="h-4 w-8" /></TableCell>
              <TableCell><Skeleton class="h-4 w-40" /></TableCell>
              <TableCell><Skeleton class="size-7" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-10" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-16" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-20" /></TableCell>
              <TableCell class="hidden md:table-cell"><Skeleton class="ml-auto h-4 w-8" /></TableCell>
            </TableRow>
          </template>
          <TableRow
            v-for="row in items"
            :key="row.id"
            data-testid="row-pool"
            :data-creator-key="row.creatorKey"
            :data-state="picked.includes(row.id) ? 'selected' : undefined"
            class="group"
            :class="canAssign ? 'cursor-pointer' : ''"
            @click="canAssign && toggle(row.id)"
          >
            <TableCell v-if="canAssign" @click.stop>
              <input
                v-model="picked"
                data-testid="row-pool-check"
                type="checkbox"
                :value="row.id"
                :aria-label="row.displayName"
                class="size-4 rounded border-input accent-primary"
              />
            </TableCell>
            <TableCell class="tabular-nums text-muted-foreground">
              <span v-if="row.rank && row.rank <= 3" class="font-semibold text-primary">#{{ row.rank }}</span>
              <span v-else>{{ row.rank ? `#${row.rank}` : '—' }}</span>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-3">
                <Avatar class="size-8 border border-border">
                  <AvatarFallback class="bg-muted text-xs text-muted-foreground">{{ row.displayName?.charAt(0) }}</AvatarFallback>
                </Avatar>
                <div class="min-w-0">
                  <div class="truncate font-medium text-foreground">{{ row.displayName }}</div>
                  <div class="truncate text-xs text-muted-foreground">
                    <template v-if="row.verticals?.length">{{ row.verticals.slice(0, 3).join(' · ') }}</template>
                    <template v-else-if="row.regions?.length">{{ row.regions.join(' · ') }}</template>
                    <template v-else>{{ row.creatorKey }}</template>
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell><GradeBadge :grade="row.grade" /></TableCell>
            <TableCell class="text-right tabular-nums">{{ formatScore(row.final) }}</TableCell>
            <TableCell class="text-right tabular-nums">
              <span v-if="row.followersUnknown" class="text-muted-foreground" :title="t('kcs.panel.unknownFollowers')">—</span>
              <template v-else>{{ formatNumber(row.followers) }}</template>
            </TableCell>
            <TableCell class="text-right tabular-nums">{{ formatPrice(row.price?.amountMin, row.price?.currency) }}</TableCell>
            <TableCell class="hidden text-right tabular-nums text-muted-foreground md:table-cell">
              {{ row.collabCount ? formatNumber(row.collabCount) : '—' }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      </div>

      <EmptyState
        v-if="!loading && !items.length"
        :title="hasFilter ? t('kcs.panel.emptyFilter') : t('kcs.panel.emptyPool')"
        :body="hasFilter ? undefined : t('kcs.panel.poolLead')"
      >
        <Button v-if="hasFilter" variant="outline" size="sm" @click="resetFilters">{{ t('kcs.panel.clearFilters') }}</Button>
      </EmptyState>

      <template v-if="canAssign" #footer>
        <div class="flex flex-wrap items-center gap-3">
          <template v-if="projectId">
            <Button data-testid="btn-assign" type="button" :disabled="!picked.length" @click="confirming = true">
              <UserPlus class="size-4" />
              {{ t('kcs.panel.assign') }}
            </Button>
            <Button
              v-if="confirming"
              data-testid="btn-assign-confirm"
              type="button"
              variant="secondary"
              :disabled="assigning"
              @click="assign"
            >
              <Check class="size-4" />
              {{ t('kcs.panel.confirmAssign') }}
            </Button>
            <span class="text-sm tabular-nums text-muted-foreground">{{ t('kcs.panel.picked', { n: picked.length }) }}</span>
          </template>
          <p v-else class="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <Info class="size-4" />
            {{ t('kcs.panel.assignHint') }}
            <NuxtLink :to="localePath('/projects')" class="ml-1 font-medium text-foreground underline-offset-4 hover:underline">
              {{ t('kcs.panel.projects') }} →
            </NuxtLink>
          </p>
        </div>
      </template>
    </TableCard>
  </PanelPage>
</template>

<script setup lang="ts">
import { ArrowLeft, Check, ChevronDown, FolderKanban, Info, SlidersHorizontal, UserPlus } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { can, rankInCohort, scoreCreator, creatorToScoreInput } from '@kcs/contract'

const { t } = useI18n()
const { request } = useApi()
const { user } = useSession()
const { formatPrice } = useCurrency()
const { formatNumber, formatScore } = useFormat()
const localePath = useLocalePath()
const route = useRoute()

const items = ref<any[]>([])
const picked = ref<string[]>([])
const followersMin = ref('')
const followersMax = ref('')
const hasCollaborated = ref('any')
const priceMin = ref('')
const priceMax = ref('')
const sort = ref('rating')
const confirming = ref(false)
const assigning = ref(false)
const loading = ref(true)
const projectName = ref('')

const projectId = computed(() => String(route.query.project || ''))
const canAssign = computed(() => Boolean(user.value && can(user.value.role, 'select.assign')))
const hasFilter = computed(() =>
  Boolean(followersMin.value || followersMax.value || priceMin.value || priceMax.value || hasCollaborated.value !== 'any'),
)

const sortOptions = computed(() => [
  { value: 'rating', label: t('kcs.panel.sortRating'), testid: 'sort-rating' },
  { value: 'followers', label: t('kcs.creators.cols.fans'), testid: 'sort-followers' },
  { value: 'price', label: t('kcs.panel.quote'), testid: 'sort-price' },
  { value: 'collab_count', label: t('kcs.panel.collaborated'), testid: 'sort-collab' },
])

let loadSeq = 0

async function load() {
  const mine = ++loadSeq
  loading.value = true
  const q = new URLSearchParams()
  if (followersMin.value) q.set('followersMin', followersMin.value)
  if (followersMax.value) q.set('followersMax', followersMax.value)
  if (hasCollaborated.value === 'true' || hasCollaborated.value === 'false') {
    q.set('hasCollaborated', hasCollaborated.value)
  }
  if (priceMin.value) q.set('priceMin', priceMin.value)
  if (priceMax.value) q.set('priceMax', priceMax.value)
  q.set('sort', sort.value)
  try {
    const rows = (await request<any>(`/api/select/pool?${q}`)).items
    if (mine !== loadSeq) return
    const finals = rows.map((row: any) => Number(row.final ?? scoreCreator(creatorToScoreInput(row)).final))
    items.value = rows.map((row: any, index: number) => ({
      ...row,
      final: finals[index],
      rank: rankInCohort(finals[index], finals),
    }))
  } finally {
    if (mine === loadSeq) loading.value = false
  }
}

async function loadProject() {
  if (!projectId.value) return
  try {
    const project = await request<any>(`/api/select/projects/${projectId.value}`)
    projectName.value = project?.name ?? ''
  } catch {
    projectName.value = ''
  }
}

function applySort(next: string) {
  if (sort.value === next) return
  sort.value = next
  load()
}

function resetFilters() {
  followersMin.value = ''
  followersMax.value = ''
  priceMin.value = ''
  priceMax.value = ''
  hasCollaborated.value = 'any'
}

function toggle(id: string) {
  picked.value = picked.value.includes(id) ? picked.value.filter((x) => x !== id) : [...picked.value, id]
}

async function assign() {
  if (!projectId.value || !picked.value.length) return
  assigning.value = true
  try {
    await request(`/api/select/projects/${projectId.value}/assignments`, {
      method: 'POST',
      body: JSON.stringify({ creatorIds: picked.value }),
    })
    confirming.value = false
    await navigateTo(localePath(`/projects/${projectId.value}`))
  } finally {
    assigning.value = false
  }
}

onMounted(() => {
  load()
  loadProject()
})
const debouncedLoad = useDebounceFn(load, 250)
watch([followersMin, followersMax, hasCollaborated, priceMin, priceMax], () => debouncedLoad())
watch(picked, () => {
  if (!picked.value.length) confirming.value = false
})
</script>
