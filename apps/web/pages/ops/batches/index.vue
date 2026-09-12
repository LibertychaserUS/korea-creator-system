<template>
  <ScreenFrame testid="screen-a-batch-list" title="批次列表">
    <p>
      <NuxtLink class="btn" :to="localePath('/ops/batches/upload')">上传批次</NuxtLink>
    </p>
    <table>
      <thead>
        <tr><th>批次</th><th>来源</th><th>状态</th><th>写入</th><th>去重</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.id">
          <td>
            <NuxtLink :to="localePath(`/ops/batches/${row.id}`)">{{ row.id }}</NuxtLink>
          </td>
          <td>{{ row.source_name || row.sourceId }}</td>
          <td>{{ row.status }}</td>
          <td>{{ row.written_count ?? row.writtenCount }}</td>
          <td>{{ row.skipped_dupes ?? row.skippedDupes }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="!items.length" class="muted">还没有批次</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const { request } = useApi()
const items = ref<any[]>([])
onMounted(async () => {
  items.value = (await request<any>('/api/ops/batches')).items || []
})
</script>
