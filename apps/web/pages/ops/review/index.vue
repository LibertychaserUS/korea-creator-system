<template>
  <ScreenFrame testid="screen-a-ai-queue" title="AI 风险复核队列">
    <p class="muted">AI 只写决策与文本 · 禁止写回分数</p>
    <table>
      <thead>
        <tr><th>达人</th><th>风险</th><th>结论</th><th>状态</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.id">
          <td>{{ row.display_name }}</td>
          <td>{{ row.risk_level }}</td>
          <td>{{ row.conclusion }}</td>
          <td>{{ row.status }}</td>
          <td>
            <NuxtLink class="btn ghost" :to="localePath(`/ops/review/${row.id}`)">查看结论</NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!items.length" class="muted">队列是空的</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const { request } = useApi()
const items = ref<any[]>([])
onMounted(async () => {
  items.value = (await request<any>('/api/ops/review')).items || []
})
</script>
