<template>
  <PanelPage
    testid="screen-c-project-board"
    :title="project.name || t('kcs.panel.board')"
    :eyebrow="t('kcs.nav.select')"
    :data-project-id="id"
  >
    <template #actions>
      <Button as-child>
        <NuxtLink data-testid="btn-open-library" :to="localePath(`/select/pool?project=${id}`)">
          {{ t('kcs.panel.openLibrary') }}
        </NuxtLink>
      </Button>
    </template>

    <Card>
      <CardContent class="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('kcs.creators.cols.rank') }}</TableHead>
              <TableHead>{{ t('kcs.creators.cols.creator') }}</TableHead>
              <TableHead>{{ t('kcs.creators.cols.grade') }}</TableHead>
              <TableHead>{{ t('kcs.creators.cols.score') }}</TableHead>
              <TableHead>{{ t('kcs.creators.cols.fans') }}</TableHead>
              <TableHead>{{ t('kcs.panel.quote') }}</TableHead>
              <TableHead>{{ t('kcs.panel.status') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in project.assignments || []"
              :key="row.creatorId"
              data-testid="row-project-assignment"
              :data-creator-key="row.creatorKey"
            >
              <TableCell>{{ row.rank ? `#${row.rank}` : '—' }}</TableCell>
              <TableCell>{{ row.displayName }}</TableCell>
              <TableCell>{{ row.grade ?? '—' }}</TableCell>
              <TableCell>{{ row.final ?? row.rating ?? '—' }}</TableCell>
              <TableCell>{{ row.followers ?? '—' }}</TableCell>
              <TableCell>{{ row.price?.amountMin ?? '—' }}</TableCell>
              <TableCell><Badge variant="secondary">{{ row.status }}</Badge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </PanelPage>
</template>

<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const id = computed(() => String(route.params.id))
const localePath = useLocalePath()
const { request } = useApi()
const project = ref<any>({ name: '', assignments: [] })

onMounted(async () => {
  project.value = await request(`/api/select/projects/${id.value}`)
})
</script>
