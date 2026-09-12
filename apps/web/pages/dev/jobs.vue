<template>
  <ScreenFrame testid="screen-b-jobs" title="批次任务队列">
    <table data-testid="table-jobs">
      <tr v-for="row in items" :key="row.id">
        <td>{{ row.id }}</td>
        <td>{{ row.status }}</td>
        <td>{{ row.written_count }}</td>
        <td>
          <button class="btn" data-testid="btn-retry-job" type="button" @click="retry(row.id)">重试</button>
        </td>
      </tr>
    </table>
  </ScreenFrame>
</template>

<script setup lang="ts">
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
