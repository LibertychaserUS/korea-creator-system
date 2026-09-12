<template>
  <ScreenFrame testid="screen-b-failures" :title="t('devDesk.failures')">
    <div v-for="row in items" :key="row.id" class="panel">
      <table class="ledger-table">
        <tbody>
          <tr>
            <td>{{ row.id }}</td>
            <td>{{ row.error_code }}</td>
            <td>{{ row.error_summary }}</td>
            <td>
              <button class="btn" data-testid="btn-retry-job" type="button" @click="retry(row.id)">{{ t('retry') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <pre v-if="row.error_summary" class="failure-stack error-stack">{{ row.error_summary }}</pre>
    </div>
    <p v-if="!items.length" class="muted">—</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { request } = useApi()
const items = ref<any[]>([])
async function load() {
  items.value = (await request<any>('/api/dev/failures')).items || []
}
onMounted(load)
async function retry(id: string) {
  await request(`/api/dev/jobs/${id}/retry`, { method: 'POST' })
  await load()
}
</script>
