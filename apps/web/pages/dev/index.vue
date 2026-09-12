<template>
  <ScreenFrame testid="screen-b-health" :title="t('devDesk.health')">
    <div class="health-tiles">
      <div class="metric-tile">
        <div class="muted">SQL</div>
        <p v-if="health.ok" data-testid="dev-sql-ok">SQL 可达</p>
      </div>
      <div class="metric-tile">
        <div class="muted">jobs</div>
        <p data-testid="dev-job-count">{{ jobCount }}</p>
      </div>
      <div class="metric-tile"><div class="muted">sources</div><strong>{{ health.sourcesEnabled }}</strong></div>
    </div>
    <table class="ledger-table" data-testid="table-jobs">
      <tbody>
        <tr v-for="row in health.jobs || []" :key="row.status"><td>{{ row.status }}</td><td>{{ row.n }}</td></tr>
      </tbody>
    </table>
  </ScreenFrame>
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
