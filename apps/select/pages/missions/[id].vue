<template>
  <PanelPage
    testid="screen-c-mission"
    :title="mission.name || t('kcs.missions.title')"
    :eyebrow="t('kcs.nav.select')"
    :lead="mission.note || undefined"
    :data-mission-id="id"
  >
    <template #actions>
      <Button as-child variant="outline" size="sm">
        <NuxtLink :to="localePath('/missions')">
          <ArrowLeft class="size-4" />
          {{ t('kcs.missions.ws.back') }}
        </NuxtLink>
      </Button>
      <Button
        v-if="canWrite"
        variant="outline"
        size="sm"
        :disabled="exporting || loading || !basket.length"
        data-testid="btn-export-mission"
        @click="exportSheet"
      >
        <Loader2 v-if="exporting" class="size-4 animate-spin" />
        <Download v-else class="size-4" />
        {{ exporting ? t('kcs.missions.ws.exporting') : t('kcs.missions.ws.export') }}
      </Button>
      <Button v-if="canWrite" size="sm" data-testid="btn-edit-mission" @click="editOpen = true">
        <Pencil class="size-4" />
        {{ t('kcs.missions.ws.briefEdit') }}
      </Button>
    </template>

    <p v-if="!canWrite && !loading" class="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{{ t('kcs.missions.readOnly') }}</p>

    <!-- 任务头：brief 卡 + 漏斗 + 池覆盖 -->
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-3 sm:gap-4">
      <Card class="gap-0 border-border/60 py-0 shadow-xs lg:col-span-1" data-testid="mission-brief">
        <div class="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <h2 class="text-sm font-semibold tracking-tight">{{ t('kcs.missions.briefTitle') }}</h2>
          <Button v-if="canWrite" variant="ghost" size="icon" class="size-8 text-muted-foreground" :title="t('kcs.missions.ws.briefEdit')" :aria-label="t('kcs.missions.ws.briefEdit')" data-testid="btn-edit-brief" @click="editOpen = true">
            <Pencil class="size-4" />
          </Button>
        </div>
        <dl v-if="briefItems.length" class="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3.5">
          <template v-for="item in briefItems" :key="item.label">
            <dt class="text-xs text-muted-foreground">{{ item.label }}</dt>
            <dd class="text-sm tabular-nums text-foreground">{{ item.value }}</dd>
          </template>
        </dl>
        <p v-else class="px-4 py-6 text-sm text-muted-foreground">{{ t('kcs.missions.briefEmpty') }}</p>
      </Card>

      <div class="grid grid-cols-3 gap-3 sm:gap-4 lg:col-span-2">
        <KpiTile :label="t('kcs.missions.ws.basketTitle')" :value="formatNumber(funnel.basket)" :icon="Users" tone="sea" data-testid="kpi-basket" />
        <KpiTile :label="t('kcs.missions.ws.decidedLabel')" :value="formatNumber(funnel.decided)" :icon="ListChecks" tone="moss" data-testid="kpi-decided" />
        <KpiTile :label="t('kcs.panel.pool')" :value="formatNumber(coverage.poolTotal)" :icon="Radar" tone="ink" :hint="t('kcs.missions.coverage', { n: formatNumber(coverage.poolTotal) })" data-testid="kpi-pool-total" />
      </div>
    </div>

    <!-- 找人 -->
    <TableCard id="find-anchor" :title="t('kcs.missions.ws.findTitle')" :description="t('kcs.missions.ws.findLead')" testid="card-find">
      <template #meta>
        <span class="tabular-nums">{{ t('kcs.missions.ws.results', { n: formatNumber(poolTotal) }) }}</span>
      </template>

      <!-- 紧凑筛选条：窄屏自动换行 -->
      <div class="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3 sm:px-5" data-testid="find-filters">
        <Input v-model="f.q" class="h-8 w-full max-w-52 px-2 text-xs" :placeholder="t('kcs.missions.ws.searchPlaceholder')" data-testid="input-find-q" @keyup.enter="searchPool" />
        <select v-model="f.tier" class="border-input h-8 rounded-md border bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" :aria-label="t('kcs.missions.ws.tier')" data-testid="select-find-tier">
          <option value="">{{ t('kcs.missions.ws.tierAny') }}</option>
          <option v-for="tier in tierIds" :key="tier" :value="tier">{{ t(`kcs.tier.${tier}`) }}</option>
        </select>
        <Input v-model="f.followersMin" type="number" min="0" step="1" class="h-8 w-24 px-2 text-xs tabular-nums" :placeholder="t('kcs.missions.ws.followersMin')" :aria-label="t('kcs.missions.ws.followersMin')" data-testid="input-find-followers-min" @keyup.enter="searchPool" />
        <Input v-model="f.followersMax" type="number" min="0" step="1" class="h-8 w-24 px-2 text-xs tabular-nums" :placeholder="t('kcs.missions.ws.followersMax')" :aria-label="t('kcs.missions.ws.followersMax')" data-testid="input-find-followers-max" @keyup.enter="searchPool" />
        <Input v-model="f.region" class="h-8 w-28 px-2 text-xs" :placeholder="t('kcs.missions.ws.region')" :aria-label="t('kcs.missions.ws.region')" data-testid="input-find-region" @keyup.enter="searchPool" />
        <Input v-model="f.priceMax" type="number" min="0" step="1" class="h-8 w-24 px-2 text-xs tabular-nums" :placeholder="t('kcs.missions.ws.priceMax')" :aria-label="t('kcs.missions.ws.priceMax')" data-testid="input-find-price-max" @keyup.enter="searchPool" />
        <Button size="sm" variant="secondary" class="h-8" :disabled="poolLoading" data-testid="btn-find-apply" @click="searchPool">
          <Loader2 v-if="poolLoading" class="size-3.5 animate-spin" aria-hidden="true" />
          {{ poolLoading ? t('kcs.missions.ws.applying') : t('kcs.missions.ws.apply') }}
        </Button>
      </div>

      <Table data-testid="table-pool-results">
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead>{{ t('kcs.missions.ws.cols.creator') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.missions.ws.cols.followers') }}</TableHead>
            <TableHead>{{ t('kcs.missions.ws.cols.engagementRate') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.panel.quote') }}</TableHead>
            <TableHead class="hidden sm:table-cell">{{ t('kcs.missions.ws.percentileLabel') }}</TableHead>
            <TableHead v-if="canWrite" class="w-10"><span class="sr-only">{{ t('kcs.missions.ws.cols.actions') }}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="poolLoading && !poolItems.length">
            <TableRow v-for="i in 4" :key="`sk-${i}`" class="hover:bg-transparent">
              <TableCell><Skeleton class="h-4 w-36" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-12" /></TableCell>
              <TableCell><Skeleton class="h-4 w-16" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-14" /></TableCell>
              <TableCell class="hidden sm:table-cell"><Skeleton class="mt-[3px] h-[2px] w-20" /></TableCell>
              <TableCell v-if="canWrite" />
            </TableRow>
          </template>
          <TableRow v-for="row in poolItems" :key="row.id" data-testid="row-pool-result" :data-creator-id="row.id">
            <TableCell>
              <div class="min-w-0">
                <div class="truncate font-medium text-foreground">{{ row.displayName }}</div>
                <div class="truncate text-[11px] text-muted-foreground">
                  <TierBadge :tier="row.tier" class="mr-1.5 align-[-2px]" />
                  <SourceBadge v-if="row.source" :source="row.source" class="align-[-2px]" />
                </div>
              </div>
            </TableCell>
            <TableCell class="text-right tabular-nums">{{ formatNumber(row.followers) }}</TableCell>
            <TableCell class="tabular-nums"><MetricValue metric-key="engagementRate" :value="row.metrics?.engagementRate" :percentile="pctOf(row.percentiles?.engagementRate)" :cohort="row.cohort" :stale="row.stale" /></TableCell>
            <TableCell class="text-right tabular-nums">{{ formatPrice(row.price?.amountMin, row.price?.currency) }}</TableCell>
            <TableCell class="hidden sm:table-cell">
              <PercentileBar :value="pctOf(row.percentiles?.engagementRate)" />
            </TableCell>
            <TableCell v-if="canWrite" class="text-right">
              <Button
                v-if="!inBasket(row.id)"
                size="sm"
                variant="outline"
                class="h-8"
                :disabled="addingId === row.id"
                :data-testid="`btn-add-${row.id}`"
                @click="addToBasket(row)"
              >
                <Loader2 v-if="addingId === row.id" class="size-3.5 animate-spin" aria-hidden="true" />
                <Plus v-else class="size-3.5" aria-hidden="true" />
                {{ t('kcs.missions.ws.add') }}
              </Button>
              <Badge v-else variant="secondary" data-testid="badge-in-basket" :class="justAdded.has(row.id) ? 'select-pop-in gap-1 pl-1.5' : ''">
                <Check v-if="justAdded.has(row.id)" class="size-3 text-primary" aria-hidden="true" />
                {{ t('kcs.missions.ws.inBasket') }}
              </Badge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <EmptyState v-if="!poolLoading && !poolError && !poolItems.length" :title="t('kcs.missions.ws.emptyPool')" :icon="SearchX" testid="find-empty" />

      <!-- 0 结果归因条 -->
      <div v-if="showExplain" class="border-t border-border/60 px-4 py-4 sm:px-5" data-testid="find-explain">
        <p class="text-sm font-medium text-foreground">{{ t('kcs.missions.ws.explainTitle') }}</p>
        <ul class="mt-2.5 space-y-1.5">
          <li v-for="(clause, i) in explainClauses" :key="i" class="select-stagger-in flex flex-wrap items-center gap-2 text-sm" :style="{ animationDelay: `${i * 80}ms` }" :data-testid="`explain-clause-${i}`">
            <span class="text-muted-foreground">{{ clause.label }}</span>
            <span class="tabular-nums" :class="clause.count === 0 ? 'font-medium text-primary' : 'text-foreground'">
              {{ clause.count == null ? t('kcs.missions.ws.explainUnknown') : t('kcs.missions.ws.explainHits', { n: formatNumber(clause.count) }) }}
            </span>
            <span v-if="clause.count === 0" class="rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs text-primary">{{ t('kcs.missions.ws.explainZero') }}</span>
          </li>
        </ul>
        <Button size="sm" variant="ghost" class="mt-2 text-primary" data-testid="btn-explain-relax" @click="relaxFilters">{{ t('kcs.missions.ws.explainRelax') }}</Button>
      </div>

      <div v-if="poolError && !poolLoading" class="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5" role="alert" data-testid="find-error">
        <p class="text-sm text-muted-foreground">{{ t('kcs.panel.error') }}</p>
        <Button variant="outline" size="sm" data-testid="btn-find-retry" @click="searchPool">{{ t('kcs.panel.retry') }}</Button>
      </div>
    </TableCard>

    <!-- 候选篮 -->
    <TableCard :title="t('kcs.missions.ws.basketTitle')" testid="card-basket">
      <template #meta>
        <span class="tabular-nums">{{ t('kcs.missions.funnel', { basket: formatNumber(funnel.basket), decided: formatNumber(funnel.decided) }) }}</span>
      </template>
      <template v-if="canWrite" #actions>
        <span class="hidden text-xs text-muted-foreground sm:inline">{{ compareHint }}</span>
        <Button v-if="compareSelected.length" size="sm" data-testid="btn-compare" @click="compareOpen = !compareOpen">
          <Columns2 class="size-4" />
          {{ t('kcs.missions.ws.compare') }}（{{ compareSelected.length }}）
        </Button>
      </template>

      <Table data-testid="table-basket">
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead v-if="canWrite" class="w-10">
              <span class="sr-only">{{ t('kcs.missions.ws.compareHint') }}</span>
            </TableHead>
            <TableHead>{{ t('kcs.missions.ws.cols.creator') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.missions.ws.cols.followers') }}</TableHead>
            <TableHead>{{ t('kcs.missions.ws.cols.engagementRate') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.missions.ws.cols.cpr') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.missions.ws.cols.cpe') }}</TableHead>
            <TableHead class="hidden sm:table-cell">{{ t('kcs.missions.ws.cols.percentile') }}</TableHead>
            <TableHead class="hidden md:table-cell">{{ t('kcs.missions.ws.cols.addedAt') }}</TableHead>
            <TableHead>{{ t('kcs.missions.ws.cols.status') }}</TableHead>
            <TableHead v-if="canWrite" class="w-10"><span class="sr-only">{{ t('kcs.missions.ws.cols.actions') }}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading && !basket.length">
            <TableRow v-for="i in 3" :key="`sk-${i}`" class="hover:bg-transparent">
              <TableCell v-if="canWrite"><Skeleton class="h-4 w-4" /></TableCell>
              <TableCell><Skeleton class="h-4 w-36" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-12" /></TableCell>
              <TableCell><Skeleton class="h-4 w-14" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-10" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-10" /></TableCell>
              <TableCell class="hidden sm:table-cell"><Skeleton class="mt-[3px] h-[2px] w-16" /></TableCell>
              <TableCell class="hidden md:table-cell"><Skeleton class="h-4 w-20" /></TableCell>
              <TableCell><Skeleton class="h-5 w-14" /></TableCell>
              <TableCell v-if="canWrite" />
            </TableRow>
          </template>
          <TableRow v-for="row in basket" :key="row.creatorId" data-testid="row-basket" :data-creator-id="row.creatorId">
            <TableCell v-if="canWrite">
              <input
                type="checkbox"
                class="accent-primary"
                :checked="compareSet.has(row.creatorId)"
                :aria-label="t('kcs.missions.ws.compare')"
                :data-testid="`compare-select-${row.creatorId}`"
                @change="toggleCompare(row.creatorId)"
              >
            </TableCell>
            <TableCell>
              <div class="min-w-0">
                <div class="truncate font-medium text-foreground">{{ row.displayName }}</div>
                <div class="truncate text-[11px] text-muted-foreground">
                  <TierBadge v-if="row.tier" :tier="row.tier" class="mr-1.5 align-[-2px]" />
                  <SourceBadge v-if="row.source" :source="row.source" class="align-[-2px]" />
                </div>
              </div>
            </TableCell>
            <TableCell class="text-right tabular-nums">{{ formatNumber(row.followers) }}</TableCell>
            <TableCell class="tabular-nums"><MetricValue metric-key="engagementRate" :value="row.metrics?.engagementRate" :percentile="pctOf(row.percentiles?.engagementRate)" /></TableCell>
            <TableCell class="text-right tabular-nums"><MetricValue metric-key="cpr" :value="row.metrics?.cpr" :percentile="null" :dot="false" /></TableCell>
            <TableCell class="text-right tabular-nums"><MetricValue metric-key="cpe" :value="row.metrics?.cpe" :percentile="null" :dot="false" /></TableCell>
            <TableCell class="hidden sm:table-cell"><PercentileBar :value="pctOf(row.percentiles?.engagementRate)" /></TableCell>
            <TableCell class="hidden whitespace-nowrap text-xs tabular-nums text-muted-foreground md:table-cell">{{ formatDateTime(row.addedAt) }}</TableCell>
            <TableCell>
              <StatusBadge v-if="row.poolGone" status="withdrawn" kind="stage" :data-testid="`badge-gone-${row.creatorId}`" />
              <StatusBadge v-else :status="row.assignmentStatus" kind="assignment" />
            </TableCell>
            <TableCell v-if="canWrite" class="text-right">
              <Button
                variant="ghost"
                size="icon"
                class="size-8 text-muted-foreground hover:text-destructive"
                :title="t('kcs.missions.ws.remove')"
                :aria-label="t('kcs.missions.ws.remove')"
                :data-testid="`btn-remove-${row.creatorId}`"
                @click="removing = row"
              >
                <UserMinus class="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <EmptyState v-if="!loading && !basket.length" :title="t('kcs.missions.ws.basketEmpty')" :body="t('kcs.missions.ws.basketEmptyBody')" :icon="Users" testid="basket-empty">
        <Button v-if="canWrite" size="sm" variant="outline" data-testid="btn-basket-go-find" @click="scrollToFind">
          <Plus class="size-4" />
          {{ t('kcs.missions.ws.basketEmptyGo') }}
        </Button>
      </EmptyState>

      <!-- 并排对比面板 -->
      <div v-if="compareOpen && compareRows.length" class="select-slide-in border-t border-border/60 px-4 py-4 sm:px-5" data-testid="compare-panel">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold tracking-tight">{{ t('kcs.missions.ws.compareTitle') }}</h3>
          <Button variant="ghost" size="sm" data-testid="btn-compare-close" @click="compareOpen = false">{{ t('kcs.missions.ws.compareClose') }}</Button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr class="border-b border-border/60 text-left">
                <th class="py-2 pr-4 text-xs font-medium text-muted-foreground">{{ t('kcs.missions.ws.compareMetric') }}</th>
                <th v-for="row in compareRows" :key="row.creatorId" class="max-w-40 truncate py-2 pr-4 text-xs font-medium text-foreground">{{ row.displayName }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="metric in compareMetrics" :key="metric.key" class="border-b border-border/40" :data-testid="`compare-row-${metric.key}`">
                <td class="py-2 pr-4 text-xs text-muted-foreground">{{ metric.label }}</td>
                <td v-for="row in compareRows" :key="row.creatorId" class="py-2 pr-4 tabular-nums text-foreground">
                  <template v-if="metric.key === 'percentile'"><PercentileBar :value="pctOf(row.percentiles?.engagementRate)" /></template>
                  <template v-else>{{ metric.format(row) }}</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </TableCard>

    <!-- 移出确认 -->
    <AlertDialog :open="Boolean(removing)" @update:open="(v: boolean) => { if (!v) removing = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('kcs.missions.ws.removeTitle', { name: removing?.displayName ?? '' }) }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('kcs.missions.ws.removeBody') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="removeBusy">{{ t('kcs.missions.ws.cancel') }}</AlertDialogCancel>
          <Button variant="destructive" :disabled="removeBusy" data-testid="btn-remove-confirm" @click="removeFromBasket">
            <Loader2 v-if="removeBusy" class="size-4 animate-spin" />
            {{ t('kcs.missions.ws.confirm') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <MissionFormDialog v-model:open="editOpen" :mission="mission" @saved="load" />
  </PanelPage>
</template>

<script setup lang="ts">
import { ArrowLeft, Check, Columns2, Download, ListChecks, Loader2, Pencil, Plus, Radar, SearchX, UserMinus, Users } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { API, apiPath, can, CREATOR_TIERS, defaultSavedQuery, type CreatorTier } from '@kcs/contract'
import MissionFormDialog from '~/components/MissionFormDialog.vue'

/** 0–100 的同类排位条：池行与篮行共用。细线型——2px 轨道 + 青色填充 + 端点微光。 */
const PercentileBar = defineComponent({
  props: { value: { type: Number as PropType<number | null>, default: null } },
  setup(props) {
    const { t } = useI18n()
    return () => {
      const empty = props.value == null
      const pct = Math.max(0, Math.min(100, props.value ?? 0))
      return h('span', { class: 'inline-flex w-24 items-center gap-1.5', 'data-percentile': props.value ?? undefined }, [
        h('span', { class: 'select-pct-track', 'aria-hidden': 'true', role: 'presentation' }, [
          empty ? null : h('span', { class: 'select-pct-fill', style: { width: `${pct}%` } }),
          empty ? null : h('span', { class: 'select-pct-dot', style: { left: `${pct}%` } }),
        ]),
        h('span', { class: 'w-8 text-right text-[11px] tabular-nums text-muted-foreground', title: t('kcs.missions.ws.percentileLabel') },
          empty ? '—' : String(Math.round(props.value!))),
      ])
    }
  },
})

const { t, locale } = useI18n()
const route = useRoute()
const id = computed(() => String(route.params.id))
const localePath = useLocalePath()
const { request, download, errorText } = useApi()
const { user } = useSession()
const { formatNumber, formatDateTime } = useFormat()
const { format } = useMetrics()
const { formatPrice } = useCurrency()

const mission = ref<any>({ name: '', note: '', brief: null })
const funnel = ref({ basket: 0, decided: 0 })
const basket = ref<any[]>([])
const coverage = ref({ poolTotal: 0 })
const loading = ref(true)

const canWrite = computed(() => Boolean(user.value && can(user.value.role, 'select.write')))
const tierIds = CREATOR_TIERS.map((x) => x.id).filter((x) => x !== 'unknown') as CreatorTier[]

/** 池行的排位：选人池给完整排位对象，篮行给 0–100 的数。 */
function pctOf(value: any): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : value.percentile
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

const briefItems = computed(() => {
  const brief = mission.value?.brief
  if (!brief || typeof brief !== 'object') return []
  const items: Array<{ label: string; value: string }> = []
  if (brief.category) items.push({ label: t('kcs.missions.briefCategory'), value: brief.category })
  if (brief.targetCount != null) items.push({ label: t('kcs.missions.briefTarget'), value: formatNumber(brief.targetCount) })
  if (brief.budgetMin != null || brief.budgetMax != null) {
    const text = [brief.budgetMin != null ? formatNumber(brief.budgetMin) : t('kcs.missions.briefNone'), brief.budgetMax != null ? formatNumber(brief.budgetMax) : t('kcs.missions.briefNone')].join(' – ')
    items.push({ label: `${t('kcs.missions.briefBudgetMin')} / ${t('kcs.missions.briefBudgetMax')}`, value: text })
  }
  if (brief.focus) items.push({ label: t('kcs.missions.briefFocus'), value: t(`kcs.missions.focus.${brief.focus}`) })
  if (brief.deadline) items.push({ label: t('kcs.missions.briefDeadline'), value: brief.deadline })
  return items
})

async function load() {
  const ws = await request<any>(apiPath('/api/select/projects/:id/workspace', { id: id.value }))
  mission.value = ws.mission ?? { name: '', note: '', brief: null }
  funnel.value = ws.funnel ?? { basket: 0, decided: 0 }
  basket.value = ws.basket ?? []
  coverage.value = ws.coverage ?? { poolTotal: 0 }
}

/* ---------- 找人 ---------- */
const f = reactive({ q: '', tier: '', followersMin: '', followersMax: '', region: '', priceMax: '' })
const poolItems = ref<any[]>([])
const poolTotal = ref(0)
const poolLoading = ref(false)
const poolError = ref(false)
const addingId = ref('')
const explainClauses = ref<Array<{ label: string; count: number | null }>>([])

const basketIds = computed(() => new Set(basket.value.map((row) => row.creatorId)))
const inBasket = (creatorId: string) => basketIds.value.has(creatorId)

async function searchPool() {
  poolLoading.value = true
  poolError.value = false
  explainClauses.value = []
  try {
    const res = await request<any>(apiPath(API.pool, {}, {
      q: f.q.trim(),
      tier: f.tier || undefined,
      followersMin: f.followersMin || undefined,
      followersMax: f.followersMax || undefined,
      region: f.region.trim() || undefined,
      priceMax: f.priceMax || undefined,
      pageSize: 20,
    }))
    poolItems.value = res.items ?? []
    poolTotal.value = res.total ?? poolItems.value.length
    if (poolTotal.value === 0) await explainZero()
  } catch {
    poolError.value = true
  } finally {
    poolLoading.value = false
  }
}

/** 把筛选条的条件翻译成保存方案的 spec；归因条的逐条标签与它一一对应。 */
function findSpec() {
  const spec = defaultSavedQuery({ name: '' })
  spec.search = f.q.trim()
  if (f.tier) spec.tiers = [f.tier as CreatorTier]
  if (f.region.trim()) spec.regions = [f.region.trim()]
  const filters: Array<{ key: string; op: 'gte' | 'lte'; value: number }> = []
  if (f.followersMin) filters.push({ key: 'followers', op: 'gte', value: Number(f.followersMin) })
  if (f.followersMax) filters.push({ key: 'followers', op: 'lte', value: Number(f.followersMax) })
  if (f.priceMax) filters.push({ key: 'priceImage', op: 'lte', value: Number(f.priceMax) })
  spec.filters = filters as any
  return spec
}

function clauseLabels(spec: ReturnType<typeof findSpec>): Array<{ key: string; label: string }> {
  const labels: Array<{ key: string; label: string }> = []
  if (spec.search) labels.push({ key: 'search', label: t('kcs.missions.ws.explainKeyword', { q: spec.search }) })
  for (const filter of spec.filters as Array<{ key: string; op: string; value: number }>) {
    if (filter.key === 'followers' && filter.op === 'gte') labels.push({ key: 'filters.followers', label: t('kcs.missions.ws.explainFollowersMin', { n: formatNumber(filter.value) }) })
    else if (filter.key === 'followers' && filter.op === 'lte') labels.push({ key: 'filters.followers', label: t('kcs.missions.ws.explainFollowersMax', { n: formatNumber(filter.value) }) })
    else if (filter.key === 'priceImage') labels.push({ key: 'filters.priceImage', label: t('kcs.missions.ws.explainPriceMax', { n: formatNumber(filter.value) }) })
    else labels.push({ key: `filters.${filter.key}`, label: `${filter.key} ${filter.op} ${filter.value}` })
  }
  if (spec.tiers.length) labels.push({ key: 'tier', label: t('kcs.missions.ws.explainTier', { tier: t(`kcs.tier.${spec.tiers[0]}`) }) })
  if (spec.regions.length) labels.push({ key: 'region', label: t('kcs.missions.ws.explainRegion', { q: spec.regions[0] }) })
  return labels
}

async function explainZero() {
  const spec = findSpec()
  try {
    const res = await request<any>(apiPath('/api/select/projects/:id/explain', { id: id.value }), {
      method: 'POST',
      body: JSON.stringify({ spec }),
    })
    // 后端按 key 返回（filters.followers 可能两条），用队列按序配对，保证标签和命中数对得上。
    const queues = new Map<string, string[]>()
    for (const { key, label } of clauseLabels(spec)) queues.set(key, [...(queues.get(key) ?? []), label])
    explainClauses.value = (res.clauses ?? []).map((clause: { key: string; count: number | null }) => {
      const queue = queues.get(clause.key) ?? []
      return { label: queue.shift() ?? clause.key, count: clause.count }
    })
  } catch {
    explainClauses.value = []
  }
}

const showExplain = computed(() => !poolLoading.value && poolTotal.value === 0 && explainClauses.value.length > 0)

function relaxFilters() {
  Object.assign(f, { q: '', tier: '', followersMin: '', followersMax: '', region: '', priceMax: '' })
  searchPool()
}

async function addToBasket(row: any) {
  addingId.value = row.id
  try {
    await request(apiPath(API.assign, { id: id.value }), { method: 'POST', body: JSON.stringify({ creatorIds: [row.id] }) })
    toast.success(t('kcs.missions.ws.added', { name: row.displayName }))
    markAdded(row.id)
    await load()
  } catch (e: unknown) {
    // 409 already_assigned：幂等入篮，提示已在篮中并刷新一次篮
    if ((e as { status?: number })?.status === 409) toast.info(t('kcs.missions.ws.inBasket'))
    else toast.error(errorText(e) || t('kcs.missions.ws.addFailed'))
    await load().catch(() => {})
  } finally {
    addingId.value = ''
  }
}

/* ---------- 微交互状态 ---------- */
/** 刚入篮成功的创作者：badge 上的对勾弹跳 1.4s 后撤掉。 */
const justAdded = ref<Set<string>>(new Set())
const addedTimers = new Map<string, ReturnType<typeof setTimeout>>()
function markAdded(creatorId: string) {
  const next = new Set(justAdded.value)
  next.add(creatorId)
  justAdded.value = next
  clearTimeout(addedTimers.get(creatorId))
  addedTimers.set(creatorId, setTimeout(() => {
    const rest = new Set(justAdded.value)
    rest.delete(creatorId)
    justAdded.value = rest
    addedTimers.delete(creatorId)
  }, 1400))
}
onBeforeUnmount(() => {
  for (const timer of addedTimers.values()) clearTimeout(timer)
  addedTimers.clear()
})

/** 空篮空态的「去找人」：锚点跳回筛选区；尊重 prefers-reduced-motion。 */
function scrollToFind() {
  const el = document.getElementById('find-anchor')
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

/* ---------- 候选篮 ---------- */
const compareSelected = ref<string[]>([])
const compareSet = computed(() => new Set(compareSelected.value))
const compareOpen = ref(false)
const compareHint = computed(() => {
  const n = compareSelected.value.length
  if (n >= 2 && n <= 4) return t('kcs.missions.ws.compareTitle')
  return t('kcs.missions.ws.compareHint')
})
const compareRows = computed(() => basket.value.filter((row) => compareSet.value.has(row.creatorId)).slice(0, 4))

function toggleCompare(creatorId: string) {
  const list = compareSelected.value
  const next = list.includes(creatorId) ? list.filter((x) => x !== creatorId) : list.length < 4 ? [...list, creatorId] : list
  compareSelected.value = next
  if (next.length >= 2) compareOpen.value = true
  if (next.length < 2) compareOpen.value = false
}

const compareMetrics = computed(() => [
  { key: 'followers', label: t('kcs.metric.followers'), format: (row: any) => formatNumber(row.followers) },
  { key: 'engagementRate', label: t('kcs.metric.engagementRate'), format: (row: any) => format('engagementRate', row.metrics?.engagementRate) },
  { key: 'readMedian', label: t('kcs.metric.readMedian'), format: (row: any) => format('readMedian', row.metrics?.readMedian) },
  { key: 'priceImage', label: t('kcs.metric.priceImage'), format: (row: any) => formatPrice(row.priceImage, 'CNY') },
  { key: 'cpr', label: t('kcs.metric.cpr'), format: (row: any) => format('cpr', row.metrics?.cpr) },
  { key: 'cpe', label: t('kcs.metric.cpe'), format: (row: any) => format('cpe', row.metrics?.cpe) },
  { key: 'percentile', label: t('kcs.missions.ws.percentileLabel'), format: () => '' },
])

const removing = ref<any>(null)
const removeBusy = ref(false)

async function removeFromBasket() {
  const row = removing.value
  if (!row) return
  removeBusy.value = true
  try {
    await request(apiPath(API.unassign, { id: id.value, creatorId: row.creatorId }), { method: 'DELETE' })
    toast.success(t('kcs.missions.ws.removed'))
    removing.value = null
    compareSelected.value = compareSelected.value.filter((x) => x !== row.creatorId)
    await load()
  } catch {
    toast.error(t('kcs.missions.ws.failed'))
  } finally {
    removeBusy.value = false
  }
}

const exporting = ref(false)
const editOpen = ref(false)

async function exportSheet() {
  exporting.value = true
  try {
    const name = (mission.value.name || 'mission').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'mission'
    await download(apiPath(API.exportProject, { id: id.value }, { locale: locale.value }), `${name}.csv`)
    toast.success(t('kcs.missions.ws.exported'))
  } catch {
    toast.error(t('kcs.missions.ws.exportFailed'))
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  try {
    await load()
    await searchPool()
  } finally {
    loading.value = false
  }
})
</script>
