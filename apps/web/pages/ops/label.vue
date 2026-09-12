<template>
  <ScreenFrame testid="screen-a-human-label" title="人工推荐 / 不推荐">
    <table>
      <thead>
        <tr><th>达人</th><th>状态</th><th>标签</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.id">
          <td>{{ row.displayName }}</td>
          <td>{{ row.status }}</td>
          <td>{{ row.label || '—' }}</td>
          <td>
            <button class="btn ghost" type="button" @click="label(row.id, 'recommended')">推荐</button>
            <button class="btn ghost" type="button" @click="label(row.id, 'rejected')">不推荐</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!items.length" class="muted">没有待标注的人</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { request } = useApi()
const items = ref<any[]>([])
async function load() {
  items.value = (await request<any>('/api/ops/creators')).items || []
}
onMounted(load)
async function label(id: string, next: string) {
  await request(`/api/ops/creators/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ label: next }),
  })
  await load()
}
</script>
