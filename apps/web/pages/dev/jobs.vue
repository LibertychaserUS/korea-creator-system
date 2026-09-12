<template>
  <ScreenFrame testid="screen-b-jobs" :title="t('devDesk.jobs')">
    <div class="pipeline-mini pipeline-steps">
      <span>Excel</span> → <span>clean</span> → <span>score</span> → <span>AI</span> → <span>publish</span>
    </div>
    <table class="ledger-table" data-testid="table-jobs">
      <tbody>
      <tr v-for="row in items" :key="row.id">
        <td>{{ row.id }}</td>
        <td>{{ row.status }}</td>
        <td>{{ row.written_count }}</td>
        <td>
          <button class="btn" data-testid="btn-retry-job" type="button" @click="retry(row.id)">{{ t('retry') }}</button>
        </td>
      </tr>
      </tbody>
    </table>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { request } = useApi()
const items = ref<any[]>([])
async function load() {
  items.value = (await request<any>('/api/dev/jobs')).items
}
onMounted(load)
async function retry(id: string) {
  await request(`/api/dev/jobs/${id}/retry`, { method: 'POST' })
  await load()
}
</script>
