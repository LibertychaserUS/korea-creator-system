<template>
  <PanelPage testid="screen-c-projects" :title="t('kcs.panel.projects')" :eyebrow="t('kcs.nav.select')">
    <template #actions>
      <Button as-child>
        <NuxtLink data-testid="btn-create-project" :to="localePath('/projects/new')">
          <Plus class="size-4" />
          {{ t('kcs.panel.createProject') }}
        </NuxtLink>
      </Button>
    </template>

    <TableCard :title="t('kcs.panel.projects')">
      <template #meta>
        <span class="tabular-nums">{{ formatNumber(items.length) }}</span>
      </template>
      <Table data-testid="table-projects">
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead>{{ t('kcs.panel.projectName') }}</TableHead>
            <TableHead class="hidden sm:table-cell">{{ t('kcs.panel.note') }}</TableHead>
            <TableHead class="w-28 text-right">{{ t('kcs.panel.members') }}</TableHead>
            <TableHead class="w-10"><span class="sr-only">{{ t('kcs.panel.detail') }}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading && !items.length">
            <TableRow v-for="i in 4" :key="`sk-${i}`" class="hover:bg-transparent">
              <TableCell><Skeleton class="h-4 w-40" /></TableCell>
              <TableCell class="hidden sm:table-cell"><Skeleton class="h-4 w-64" /></TableCell>
              <TableCell><Skeleton class="ml-auto h-4 w-8" /></TableCell>
              <TableCell />
            </TableRow>
          </template>
          <TableRow
            v-for="row in items"
            :key="row.id"
            class="group cursor-pointer"
            @click="navigateTo(localePath(`/projects/${row.id}`))"
          >
            <TableCell>
              <div class="flex items-center gap-3">
                <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
                  <FolderKanban class="size-4" />
                </span>
                <NuxtLink
                  class="font-medium text-foreground underline-offset-4 group-hover:underline"
                  :to="localePath(`/projects/${row.id}`)"
                  @click.stop
                >
                  {{ row.name }}
                </NuxtLink>
              </div>
            </TableCell>
            <TableCell class="hidden max-w-md truncate text-muted-foreground sm:table-cell">{{ row.note || '—' }}</TableCell>
            <TableCell class="text-right tabular-nums">
              <span class="inline-flex min-w-8 items-center justify-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                {{ formatNumber(row.member_count) }}
              </span>
            </TableCell>
            <TableCell class="text-muted-foreground">
              <ChevronRight class="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <EmptyState v-if="!loading && !items.length" :title="t('kcs.panel.emptyProjects')" :icon="FolderKanban">
        <Button as-child size="sm">
          <NuxtLink :to="localePath('/projects/new')">{{ t('kcs.panel.createProject') }}</NuxtLink>
        </Button>
      </EmptyState>
    </TableCard>
  </PanelPage>
</template>

<script setup lang="ts">
import { ChevronRight, FolderKanban, Plus } from 'lucide-vue-next'

const { t } = useI18n()
const localePath = useLocalePath()
const { request } = useApi()
const { formatNumber } = useFormat()
const items = ref<any[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    items.value = (await request<any>('/api/select/projects')).items
  } finally {
    loading.value = false
  }
})
</script>
