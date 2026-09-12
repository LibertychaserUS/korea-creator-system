<template>
  <ScreenFrame testid="screen-b-failures" title="失败与重试">
    <table>
      <thead>
        <tr><th>任务</th><th>错误</th><th>摘要</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.id">
          <td>{{ row.id }}</td>
          <td>{{ row.error_code }}</td>
          <td>{{ row.error_summary }}</td>
          <td>
            <button class="btn" data-testid="btn-retry-job" type="button" @click="retry(row.id)">重试</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!items.length" class="muted">没有失败任务</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
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
