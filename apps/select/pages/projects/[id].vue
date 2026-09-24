<template>
  <PanelPage
    testid="screen-c-project-board"
    :title="project.name || t('kcs.panel.board')"
    :eyebrow="t('kcs.nav.select')"
    :lead="project.note || undefined"
    :data-project-id="id"
  >
    <template #actions>
      <Button as-child variant="outline" size="sm">
        <NuxtLink :to="localePath('/projects')">
          <ArrowLeft class="size-4" />
          {{ t('kcs.panel.projects') }}
        </NuxtLink>
      </Button>
      <Button
        variant="outline"
        size="sm"
        :disabled="exporting || loading || !assignments.length"
        :title="t('kcs.projectBoard.exportHint')"
        :data-testid="TESTID.btnExportProject"
        @click="exportSheet"
      >
        <Loader2 v-if="exporting" class="size-4 animate-spin" />
        <Download v-else class="size-4" />
        {{ exporting ? t('kcs.projectBoard.exporting') : t('kcs.projectBoard.export') }}
      </Button>
      <Button v-if="canAssign" as-child>
        <NuxtLink data-testid="btn-open-library" :to="localePath(`/?project=${id}`)">
          <UserPlus class="size-4" />
          {{ t('kcs.panel.openLibrary') }}
        </NuxtLink>
      </Button>
    </template>

    <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiTile :label="t('kcs.panel.members')" :value="formatNumber(assignments.length)" :icon="Users" tone="sea" />
      <KpiTile :label="t('kcs.metric.cpe')" :value="format('cpe', medianCpe)" :icon="Gauge" tone="sand" :hint="t('kcs.metricHelp.cpe')" />
      <KpiTile :label="t('kcs.creators.cols.fans')" :value="formatNumber(totalFollowers, { notation: 'compact' })" :icon="Radio" tone="moss" />
      <KpiTile
        :label="t('kcs.panel.quote')"
        :icon="Coins"
        tone="ink"
        :hint="quote.missing ? t('kcs.display.quoteMissing', { n: quote.missing }) : undefined"
      >
        {{ formatPrice(quote.total, 'CNY') }}
      </KpiTile>
    </div>

    <TableCard :title="t('kcs.panel.board')">
      <template #meta>
        <span class="tabular-nums">{{ t('kcs.panel.members') }} · {{ formatNumber(assignments.length) }}</span>
      </template>
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead>{{ t('kcs.creators.cols.creator') }}</TableHead>
            <TableHead class="w-24">{{ t('kcs.tier.label') }}</TableHead>
            <TableHead class="w-24">{{ t('kcs.health.label') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.metric.cpe') }}</TableHead>
            <TableHead class="hidden text-right md:table-cell">{{ t('kcs.metric.engagementRate') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.creators.cols.fans') }}</TableHead>
            <TableHead class="hidden text-right sm:table-cell">{{ t('kcs.panel.quote') }}</TableHead>
            <TableHead class="w-28">{{ t('kcs.panel.status') }}</TableHead>
            <TableHead v-if="canAssign" class="w-12"><span class="sr-only">{{ t('kcs.projectBoard.actions') }}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading && !assignments.length">
            <TableRow v-for="i in 3" :key="`sk-${i}`" class="hover:bg-transparent">
              <TableCell><Skeleton class="h-4 w-40" /></TableCell>
              <TableCell><Skeleton class="h-5 w-12" /></TableCell>
              <TableCell><Skeleton class="h-5 w-12" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-10" /></TableCell>
              <TableCell class="hidden md:table-cell"><Skeleton class="ml-auto h-4 w-10" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-16" /></TableCell>
              <TableCell class="hidden sm:table-cell"><Skeleton class="ml-auto h-4 w-20" /></TableCell>
              <TableCell><Skeleton class="h-5 w-16" /></TableCell>
              <TableCell v-if="canAssign" />
            </TableRow>
          </template>
          <TableRow
            v-for="row in assignments"
            :key="row.creatorId"
            data-testid="row-project-assignment"
            :data-creator-key="row.creatorKey"
          >
            <TableCell>
              <div class="flex items-center gap-3">
                <Avatar class="size-8 border border-border">
                  <AvatarFallback class="bg-muted text-xs text-muted-foreground">{{ row.displayName?.charAt(0) }}</AvatarFallback>
                </Avatar>
                <div class="min-w-0">
                  <div class="truncate font-medium text-foreground">{{ row.displayName }}</div>
                  <div v-if="row.xhsId" class="truncate text-[11px] text-muted-foreground">@{{ row.xhsId }}</div>
                </div>
              </div>
            </TableCell>
            <TableCell><TierBadge :tier="row.tier" /></TableCell>
            <TableCell><HealthBadge :health="row.metrics?.health ?? row.health" /></TableCell>
            <TableCell class="text-right"><MetricValue metric-key="cpe" :value="row.metrics?.cpe" :rank="row.percentiles?.cpe" :cohort="row.cohort" :stale="row.stale" /></TableCell>
            <TableCell class="hidden text-right md:table-cell"><MetricValue metric-key="engagementRate" :value="row.metrics?.engagementRate" :rank="row.percentiles?.engagementRate" :cohort="row.cohort" :stale="row.stale" /></TableCell>
            <TableCell class="text-right tabular-nums">{{ formatNumber(row.followers) }}</TableCell>
            <TableCell class="hidden text-right tabular-nums sm:table-cell">
              {{ formatPrice(row.price?.amountMin, row.price?.currency) }}
            </TableCell>
            <TableCell>
              <StatusBadge v-if="row.poolGone" status="withdrawn" kind="stage" />
              <StatusBadge v-else :status="row.status" kind="assignment" />
            </TableCell>
            <TableCell v-if="canAssign" class="text-right">
              <Button
                variant="ghost"
                size="icon"
                class="size-8 text-muted-foreground hover:text-destructive"
                :title="t('kcs.projectBoard.remove')"
                :aria-label="t('kcs.projectBoard.remove')"
                :data-testid="TESTID.btnRemoveAssignment"
                @click="removing = row"
              >
                <UserMinus class="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <EmptyState v-if="!loading && !assignments.length" :title="t('kcs.panel.noAssignments')" :icon="Users">
        <Button v-if="canAssign" as-child size="sm">
          <NuxtLink :to="localePath(`/?project=${id}`)">{{ t('kcs.panel.openLibrary') }}</NuxtLink>
        </Button>
      </EmptyState>
    </TableCard>

    <AlertDialog :open="Boolean(removing)" @update:open="(v: boolean) => { if (!v) removing = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('kcs.projectBoard.removeTitle', { name: removing?.displayName ?? '' }) }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('kcs.projectBoard.removeBody') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="removeBusy">{{ t('kcs.projectBoard.cancel') }}</AlertDialogCancel>
          <Button variant="destructive" :disabled="removeBusy" :data-testid="TESTID.btnRemoveAssignmentConfirm" @click="removeAssignment">
            <Loader2 v-if="removeBusy" class="size-4 animate-spin" />
            {{ t('kcs.projectBoard.confirm') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </PanelPage>
</template>

<script setup lang="ts">
import { ArrowLeft, Coins, Download, Gauge, Loader2, Radio, UserMinus, UserPlus, Users } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { API, apiPath, TESTID, can } from '@kcs/contract'

const { t, locale } = useI18n()
const route = useRoute()
const id = computed(() => String(route.params.id))
const localePath = useLocalePath()
const { request, download } = useApi()
const { user } = useSession()
const { formatPrice, sumCny } = useCurrency()
const { formatNumber } = useFormat()
const { format } = useMetrics()
const project = ref<any>({ name: '', note: '', assignments: [] })
const loading = ref(true)

const assignments = computed<any[]>(() => project.value.assignments || [])
const canAssign = computed(() => Boolean(user.value && can(user.value.role, 'select.assign')))

const medianCpe = computed(() => {
  const vals = assignments.value.map((r) => Number(r.metrics?.cpe)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  return vals.length ? vals[Math.floor(vals.length / 2)] : null
})
const totalFollowers = computed(() => assignments.value.reduce((sum, r) => sum + (Number(r.followers) || 0), 0))
const quote = computed(() => sumCny(assignments.value.map((r) => ({ amount: r.price?.amountMin, currency: r.price?.currency, fxToCny: r.price?.fxToCny }))))

const exporting = ref(false)
const removing = ref<any>(null)
const removeBusy = ref(false)

async function load() {
  project.value = await request(apiPath(API.projectGet, { id: id.value }))
}

async function exportSheet() {
  exporting.value = true
  try {
    const name = (project.value.name || 'project').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'project'
    await download(apiPath(API.exportProject, { id: id.value }, { locale: locale.value }), `${name}.csv`)
    toast.success(t('kcs.projectBoard.exported'))
  } catch {
    toast.error(t('kcs.projectBoard.failed'))
  } finally {
    exporting.value = false
  }
}

async function removeAssignment() {
  const row = removing.value
  if (!row) return
  removeBusy.value = true
  try {
    await request(apiPath(API.unassign, { id: id.value, creatorId: row.creatorId }), { method: 'DELETE' })
    toast.success(t('kcs.projectBoard.removed'))
    removing.value = null
    await load()
  } catch {
    toast.error(t('kcs.projectBoard.failed'))
  } finally {
    removeBusy.value = false
  }
}

onMounted(async () => {
  try {
    await load()
  } finally {
    loading.value = false
  }
})
</script>
