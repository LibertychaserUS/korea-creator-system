<template>
  <ScreenFrame testid="screen-b-audit" title="操作审计">
    <table>
      <thead>
        <tr><th>时间</th><th>动作</th><th>对象</th><th>摘要</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.id">
          <td>{{ row.created_at }}</td>
          <td>{{ row.action }}</td>
          <td>{{ row.entity_type }} {{ row.entity_id }}</td>
          <td>{{ row.summary }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="!items.length" class="muted">还没有审计记录</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { request } = useApi()
const items = ref<any[]>([])
onMounted(async () => {
  items.value = (await request<any>('/api/dev/audit')).items || []
})
</script>
