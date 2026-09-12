<template>
  <ScreenFrame testid="screen-ops-category" title="分类词表">
    <table>
      <thead>
        <tr><th>slug</th><th>中文</th><th>EN</th><th>한국어</th><th>组</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.slug">
          <td>{{ row.slug }}</td>
          <td>{{ row.name_zh }}</td>
          <td>{{ row.name_en }}</td>
          <td>{{ row.name_ko }}</td>
          <td>{{ row.group_name || '—' }}</td>
        </tr>
      </tbody>
    </table>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { request } = useApi()
const items = ref<any[]>([])
onMounted(async () => {
  items.value = (await request<any>('/api/ops/categories')).items || []
})
</script>
