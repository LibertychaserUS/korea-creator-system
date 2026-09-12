<template>
  <ScreenFrame testid="screen-b-health" title="系统健康">
    <p v-if="health.ok" data-testid="dev-sql-ok">SQL 可达</p>
    <p data-testid="dev-job-count">{{ jobCount }}</p>
    <div class="cards">
      <div class="card"><div class="muted">启用源</div><strong>{{ health.sourcesEnabled }}</strong></div>
    </div>
    <table data-testid="table-jobs">
      <tr v-for="row in health.jobs || []" :key="row.status"><td>{{ row.status }}</td><td>{{ row.n }}</td></tr>
    </table>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { request } = useApi()
const health = ref<any>({ jobs: [], sourcesEnabled: 0, ok: false, jobCount: 0 })
const jobCount = computed(() => Number(health.value.jobCount ?? 0))
onMounted(async () => {
  health.value = await request('/api/dev/health')
})
</script>
