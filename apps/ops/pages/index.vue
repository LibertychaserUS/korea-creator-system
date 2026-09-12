<template>
  <PanelPage testid="screen-a-home" :title="t('kcs.panel.opsHome')" :eyebrow="t('kcs.nav.ops')">
    <template #actions>
      <Button as-child>
        <NuxtLink data-testid="btn-create-creator" :to="localePath('/ops/creators/new')">
          {{ t('kcs.panel.createCreator') }}
        </NuxtLink>
      </Button>
    </template>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card
        v-for="tile in tiles"
        :key="tile.key"
        class="relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-muted/30 shadow-sm"
      >
        <CardHeader class="pb-2">
          <CardDescription>{{ tile.label }}</CardDescription>
          <CardTitle class="text-2xl">{{ counts[tile.key] }}</CardTitle>
        </CardHeader>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>{{ t('kcs.panel.recentBatches') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>{{ t('kcs.panel.ready') }}</TableHead>
              <TableHead>{{ t('kcs.panel.status') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="job in jobs" :key="job.id">
              <TableCell class="font-medium">{{ job.id }}</TableCell>
              <TableCell>{{ job.written_count }}</TableCell>
              <TableCell><Badge variant="secondary">{{ job.status }}</Badge></TableCell>
            </TableRow>
            <TableRow v-if="!jobs.length">
              <TableCell colspan="3" class="text-muted-foreground">{{ t('kcs.panel.emptyBatches') }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </PanelPage>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { request } = useApi()
const counts = ref({ draft: 0, review: 0, ready: 0, released: 0 })
const jobs = ref<any[]>([])

const tiles = computed(() => [
  { key: 'draft' as const, label: t('kcs.panel.draft') },
  { key: 'review' as const, label: t('kcs.panel.review') },
  { key: 'ready' as const, label: t('kcs.panel.ready') },
  { key: 'released' as const, label: t('kcs.panel.released') },
])

onMounted(async () => {
  const data = await request<any>('/api/ops/overview')
  counts.value = data.counts
  jobs.value = data.recentJobs
})
</script>
