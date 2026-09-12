<template>
  <ScreenFrame testid="screen-a-creator-qc" title="字段校对">
    <table>
      <thead>
        <tr><th>达人</th><th>状态</th><th>粉丝</th><th>校对备注</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.id">
          <td>{{ row.displayName }}</td>
          <td>{{ row.status }}</td>
          <td>{{ row.followers ?? '未知' }}</td>
          <td>
            <input v-model="notes[row.id]" class="field" />
            <button class="btn ghost" type="button" @click="save(row.id)">保存校对</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!items.length" class="muted">没有待校对的人</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { request } = useApi()
const items = ref<any[]>([])
const notes = reactive<Record<string, string>>({})
onMounted(async () => {
  items.value = (await request<any>('/api/ops/creators')).items || []
  for (const row of items.value) notes[row.id] = row.qcNotes || ''
})
async function save(id: string) {
  await request(`/api/ops/creators/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ qcNotes: notes[id] }),
  })
}
</script>
