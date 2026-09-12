<template>
  <ScreenFrame testid="screen-a-publish" title="发布到前台选人池">
    <table>
      <tr v-for="row in items" :key="row.id">
        <td>{{ row.displayName }}</td>
        <td>{{ row.status }}</td>
        <td>
          <button class="btn" data-testid="btn-publish" type="button" @click="publish(row.id)">发布</button>
        </td>
      </tr>
    </table>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { request } = useApi()
const items = ref<any[]>([])
onMounted(async () => {
  items.value = (await request<any>('/api/ops/creators')).items
})
async function publish(id: string) {
  await request(`/api/ops/creators/${id}/publish`, { method: 'POST' })
  items.value = (await request<any>('/api/ops/creators')).items
}
</script>
