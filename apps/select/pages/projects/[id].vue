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
      <Button v-if="canAssign" as-child>
        <NuxtLink data-testid="btn-open-library" :to="localePath(`/?project=${id}`)">
          <UserPlus class="size-4" />
          {{ t('kcs.panel.openLibrary') }}
        </NuxtLink>
      </Button>
    </template>

    <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiTile :label="t('kcs.panel.members')" :value="formatNumber(assignments.length)" :icon="Users" tone="sea" />
      <KpiTile :label="t('kcs.creators.cols.score')" :value="formatScore(avgScore)" :icon="Gauge" tone="sand" :hint="t('kcs.panel.kpiHint')" />
      <KpiTile :label="t('kcs.creators.cols.fans')" :value="formatNumber(totalFollowers, { notation: 'compact' })" :icon="Radio" tone="moss" />
      <KpiTile :label="t('kcs.panel.quote')" :icon="Coins" tone="ink">
        {{ formatPrice(totalQuote, 'CNY') }}
      </KpiTile>
    </div>

    <TableCard :title="t('kcs.panel.board')">
      <template #meta>
        <span class="tabular-nums">{{ t('kcs.panel.members') }} · {{ formatNumber(assignments.length) }}</span>
      </template>
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-16">{{ t('kcs.creators.cols.rank') }}</TableHead>
            <TableHead>{{ t('kcs.creators.cols.creator') }}</TableHead>
            <TableHead class="w-20">{{ t('kcs.creators.cols.grade') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.creators.cols.score') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.creators.cols.fans') }}</TableHead>
            <TableHead class="hidden text-right sm:table-cell">{{ t('kcs.panel.quote') }}</TableHead>
            <TableHead class="w-28">{{ t('kcs.panel.status') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading && !assignments.length">
            <TableRow v-for="i in 3" :key="`sk-${i}`" class="hover:bg-transparent">
              <TableCell><Skeleton class="h-4 w-8" /></TableCell>
              <TableCell><Skeleton class="h-4 w-40" /></TableCell>
              <TableCell><Skeleton class="size-7" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-10" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-16" /></TableCell>
              <TableCell class="hidden sm:table-cell"><Skeleton class="ml-auto h-4 w-20" /></TableCell>
              <TableCell><Skeleton class="h-5 w-16" /></TableCell>
            </TableRow>
          </template>
          <TableRow
            v-for="row in assignments"
            :key="row.creatorId"
            data-testid="row-project-assignment"
            :data-creator-key="row.creatorKey"
          >
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
                  <div class="truncate font-mono text-[11px] text-muted-foreground">{{ row.creatorKey }}</div>
                </div>
              </div>
            </TableCell>
            <TableCell><GradeBadge :grade="row.grade" /></TableCell>
            <TableCell class="text-right tabular-nums">{{ formatScore(row.final ?? row.rating) }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ formatNumber(row.followers) }}</TableCell>
            <TableCell class="hidden text-right tabular-nums sm:table-cell">
              {{ formatPrice(row.price?.amountMin, row.price?.currency) }}
            </TableCell>
            <TableCell>
              <StatusBadge :status="row.poolGone ? 'removed' : row.status" kind="assignment" />
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
  </PanelPage>
</template>

<script setup lang="ts">
import { ArrowLeft, Coins, Gauge, Radio, UserPlus, Users } from 'lucide-vue-next'
import { can } from '@kcs/contract'

const { t } = useI18n()
const route = useRoute()
const id = computed(() => String(route.params.id))
const localePath = useLocalePath()
const { request } = useApi()
const { user } = useSession()
const { formatPrice, toCny } = useCurrency()
const { formatNumber, formatScore } = useFormat()
const project = ref<any>({ name: '', note: '', assignments: [] })
const loading = ref(true)

const assignments = computed<any[]>(() => project.value.assignments || [])
const canAssign = computed(() => Boolean(user.value && can(user.value.role, 'select.assign')))

const avgScore = computed(() => {
  const vals = assignments.value.map((r) => Number(r.final ?? r.rating)).filter((n) => !Number.isNaN(n))
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
})
const totalFollowers = computed(() => assignments.value.reduce((sum, r) => sum + (Number(r.followers) || 0), 0))
const totalQuote = computed(() => assignments.value.reduce((sum, r) => sum + toCny(r.price?.amountMin, r.price?.currency), 0))

onMounted(async () => {
  try {
    project.value = await request(`/api/select/projects/${id.value}`)
  } finally {
    loading.value = false
  }
})
</script>
