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
            <TableHead v-if="canWrite" class="w-10"><span class="sr-only">{{ t('kcs.projectDelete.actions') }}</span></TableHead>
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
                {{ formatNumber(row.memberCount) }}
              </span>
            </TableCell>
            <TableCell v-if="canWrite" class="text-right">
              <Button
                variant="ghost"
                size="icon"
                class="size-8 text-muted-foreground hover:text-destructive"
                :title="t('kcs.projectDelete.delete')"
                :aria-label="t('kcs.projectDelete.delete')"
                data-testid="btn-delete-project"
                @click.stop="removing = row"
              >
                <Trash2 class="size-4" />
              </Button>
            </TableCell>
            <TableCell class="text-muted-foreground">
              <ChevronRight class="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <EmptyState v-if="!loading && !loadError && !items.length" :title="t('kcs.panel.emptyProjects')" :icon="FolderKanban">
        <Button as-child size="sm">
          <NuxtLink :to="localePath('/projects/new')">{{ t('kcs.panel.createProject') }}</NuxtLink>
        </Button>
      </EmptyState>
      <div v-else-if="loadError && !loading" class="flex flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-5" role="alert" data-testid="projects-error">
        <p class="text-sm text-muted-foreground">{{ t('kcs.states.error') }}</p>
        <Button variant="outline" size="sm" data-testid="btn-projects-retry" @click="load()">{{ t('kcs.panel.retry') }}</Button>
      </div>
    </TableCard>

    <!-- 删除项目：409 project_not_empty 时把原因留在弹窗里 -->
    <AlertDialog :open="Boolean(removing)" @update:open="(v: boolean) => { if (!v) { removing = null; removeError = '' } }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('kcs.projectDelete.deleteTitle', { name: removing?.name ?? '' }) }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('kcs.projectDelete.deleteBody') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <p v-if="removeError" role="alert" class="text-sm text-destructive" data-testid="project-delete-error">{{ removeError }}</p>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="removeBusy">{{ t('kcs.projectDelete.cancel') }}</AlertDialogCancel>
          <Button variant="destructive" :disabled="removeBusy" data-testid="btn-delete-project-confirm" @click="removeProject">
            <Loader2 v-if="removeBusy" class="size-4 animate-spin" />
            {{ t('kcs.projectDelete.confirm') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </PanelPage>
</template>

<script setup lang="ts">
import { API, apiPath, can } from '@kcs/contract'
import { ChevronRight, FolderKanban, Loader2, Plus, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const { t } = useI18n()
const localePath = useLocalePath()
const { request, errorText } = useApi()
const { user } = useSession()
const { formatNumber } = useFormat()
const items = ref<any[]>([])
const loading = ref(true)
const loadError = ref(false)

const canWrite = computed(() => Boolean(user.value && can(user.value.role, 'select.write')))
const removing = ref<any>(null)
const removeBusy = ref(false)
const removeError = ref('')

async function load() {
  try {
    items.value = (await request<any>(API.projects.path)).items
    loadError.value = false
  } catch {
    loadError.value = true
  }
}

async function removeProject() {
  const row = removing.value
  if (!row) return
  removeBusy.value = true
  removeError.value = ''
  try {
    await request(apiPath('/api/select/projects/:id', { id: row.id }), { method: 'DELETE' })
    items.value = items.value.filter((item) => item.id !== row.id)
    removing.value = null
    toast.success(t('kcs.projectDelete.deleted', { name: row.name }))
  } catch (e: unknown) {
    // 409 project_not_empty：errorText 会命中 kcs.apiError.project_not_empty，留在弹窗里提示先移除成员
    removeError.value = errorText(e)
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
