<template>
  <PanelPage testid="screen-c-missions" :title="t('kcs.missions.title')" :eyebrow="t('kcs.nav.select')" :lead="t('kcs.missions.lead')">
    <template #actions>
      <Button v-if="canWrite" data-testid="btn-create-mission" @click="openDialog(null)">
        <Plus class="size-4" />
        {{ t('kcs.missions.new') }}
      </Button>
    </template>

    <p v-if="!canWrite && !loading" class="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{{ t('kcs.missions.readOnly') }}</p>

    <TableCard :title="t('kcs.missions.title')" testid="table-missions">
      <template #meta>
        <span class="tabular-nums">{{ formatNumber(items.length) }}</span>
      </template>
      <Table data-testid="table-missions-list">
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead>{{ t('kcs.missions.cols.name') }}</TableHead>
            <TableHead class="hidden md:table-cell">{{ t('kcs.missions.cols.brief') }}</TableHead>
            <TableHead>{{ t('kcs.missions.cols.funnel') }}</TableHead>
            <TableHead class="hidden sm:table-cell">{{ t('kcs.missions.cols.created') }}</TableHead>
            <TableHead class="w-10"><span class="sr-only">{{ t('kcs.missions.cols.actions') }}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading && !items.length">
            <TableRow v-for="i in 4" :key="`sk-${i}`" class="hover:bg-transparent">
              <TableCell><Skeleton class="h-4 w-44" /></TableCell>
              <TableCell class="hidden md:table-cell"><Skeleton class="h-4 w-56" /></TableCell>
              <TableCell><Skeleton class="h-4 w-24" /></TableCell>
              <TableCell class="hidden sm:table-cell"><Skeleton class="h-4 w-20" /></TableCell>
              <TableCell />
            </TableRow>
          </template>
          <TableRow
            v-for="row in items"
            :key="row.id"
            class="group cursor-pointer"
            data-testid="row-mission"
            @click="navigateTo(localePath(`/missions/${row.id}`))"
          >
            <TableCell>
              <div class="flex items-center gap-3">
                <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
                  <Target class="size-4" />
                </span>
                <div class="min-w-0">
                  <NuxtLink
                    class="block truncate font-medium text-foreground underline-offset-4 group-hover:underline"
                    :to="localePath(`/missions/${row.id}`)"
                    @click.stop
                  >
                    {{ row.name }}
                  </NuxtLink>
                  <p v-if="row.note" class="truncate text-xs text-muted-foreground">{{ row.note }}</p>
                </div>
              </div>
            </TableCell>
            <TableCell class="hidden max-w-md md:table-cell">
              <span v-if="briefLine(row)" class="truncate text-muted-foreground">{{ briefLine(row) }}</span>
              <span v-else class="text-xs text-muted-foreground/70">{{ t('kcs.missions.summaryEmpty') }}</span>
            </TableCell>
            <TableCell class="tabular-nums text-muted-foreground">
              <span v-if="row.funnel">{{ t('kcs.missions.funnel', { basket: formatNumber(row.funnel.basket), decided: formatNumber(row.funnel.decided) }) }}</span>
              <span v-else>{{ t('kcs.missions.basketOnly', { n: formatNumber(row.memberCount ?? 0) }) }}</span>
            </TableCell>
            <TableCell class="hidden whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:table-cell">{{ formatDateTime(row.createdAt) }}</TableCell>
            <TableCell class="text-muted-foreground">
              <ChevronRight class="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <EmptyState v-if="!loading && !loadError && !items.length" :title="t('kcs.missions.empty')" :body="t('kcs.missions.emptyBody')" :icon="Target" testid="missions-empty">
        <Button v-if="canWrite" size="sm" data-testid="btn-create-mission-empty" @click="openDialog(null)">
          <Plus class="size-4" />
          {{ t('kcs.missions.new') }}
        </Button>
      </EmptyState>
      <div v-else-if="loadError && !loading" class="flex flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-5" role="alert" data-testid="missions-error">
        <p class="text-sm text-muted-foreground">{{ t('kcs.panel.error') }}</p>
        <Button variant="outline" size="sm" data-testid="btn-missions-retry" @click="load()">{{ t('kcs.panel.retry') }}</Button>
      </div>
    </TableCard>

    <MissionFormDialog v-model:open="dialogOpen" :mission="editing" @saved="onSaved" />
  </PanelPage>
</template>

<script setup lang="ts">
import { ChevronRight, Plus, Target } from 'lucide-vue-next'
import { API, can } from '@kcs/contract'
import MissionFormDialog from '~/components/MissionFormDialog.vue'

const { t } = useI18n()
const localePath = useLocalePath()
const { request } = useApi()
const { user } = useSession()
const { formatNumber, formatDateTime } = useFormat()

const items = ref<any[]>([])
const loading = ref(true)
const loadError = ref(false)
const canWrite = computed(() => Boolean(user.value && can(user.value.role, 'select.write')))

const dialogOpen = ref(false)
const editing = ref<any | null>(null)

function openDialog(mission: any | null) {
  editing.value = mission
  dialogOpen.value = true
}

async function load() {
  try {
    const res = await request<any>(API.projects.path)
    items.value = res.items ?? []
    loadError.value = false
  } catch {
    loadError.value = true
  }
}

function onSaved(id: string) {
  load()
  if (id && !editing.value) navigateTo(localePath(`/missions/${id}`))
}

/** brief 摘要行：品类 · 目标人数 · 截止；全空返回 ''。 */
function briefLine(row: any): string {
  const brief = row.brief
  if (!brief || typeof brief !== 'object') return ''
  const parts: string[] = []
  if (brief.category) parts.push(brief.category)
  if (brief.targetCount != null) parts.push(`${t('kcs.missions.briefTarget')} ${formatNumber(brief.targetCount)}`)
  if (brief.deadline) parts.push(`${t('kcs.missions.briefDeadline')} ${brief.deadline}`)
  return parts.join(' · ')
}

onMounted(async () => {
  try {
    await load()
  } finally {
    loading.value = false
  }
})
</script>
