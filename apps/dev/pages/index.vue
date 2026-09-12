<template>
  <PanelPage testid="screen-b-health" :title="t('kcs.panel.health')" :eyebrow="t('kcs.nav.monitor')">
    <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Card class="relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-muted/30">
        <CardHeader>
          <CardDescription>SQL</CardDescription>
          <CardTitle v-if="health.ok" data-testid="dev-sql-ok">{{ t('kcs.panel.sqlOk') }}</CardTitle>
        </CardHeader>
      </Card>
      <Card class="relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-muted/30">
        <CardHeader>
          <CardDescription>{{ t('kcs.panel.jobs') }}</CardDescription>
          <CardTitle data-testid="dev-job-count">{{ jobCount }}</CardTitle>
        </CardHeader>
      </Card>
      <Card class="relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-muted/30">
        <CardHeader>
          <CardDescription>sources</CardDescription>
          <CardTitle>{{ health.sourcesEnabled }}</CardTitle>
        </CardHeader>
      </Card>
    </div>

    <Card>
      <CardContent class="pt-6">
        <Table data-testid="table-jobs">
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('kcs.panel.status') }}</TableHead>
              <TableHead>n</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in health.jobs || []" :key="row.status">
              <TableCell>{{ row.status }}</TableCell>
              <TableCell>{{ row.n }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </PanelPage>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { request } = useApi()
const health = ref<any>({ jobs: [], sourcesEnabled: 0, ok: false, jobCount: 0 })
const jobCount = computed(() => Number(health.value.jobCount ?? 0))

onMounted(async () => {
  health.value = await request('/api/dev/health')
})
</script>
