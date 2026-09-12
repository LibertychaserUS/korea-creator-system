<template>
  <ScreenFrame testid="screen-a-ai-detail" :title="`单条风险结论 · ${id}`">
    <div v-if="item.id" class="panel">
      <p>达人 {{ item.display_name }}</p>
      <p>风险 {{ item.risk_level }}</p>
      <p>结论 {{ item.conclusion }}</p>
      <p>状态 {{ item.status }}</p>
      <p class="muted">不改规则分</p>
      <button v-if="item.status === 'pending'" class="btn" type="button" @click="pass">复核通过</button>
    </div>
    <p v-else class="muted">没有这条结论</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id))
const { request } = useApi()
const item = ref<any>({})
onMounted(async () => {
  const data = await request<any>('/api/ops/review')
  item.value = (data.items || []).find((row: any) => String(row.id) === id.value) || {}
})
async function pass() {
  await request(`/api/ops/review/${id.value}/pass`, { method: 'POST' })
  item.value = { ...item.value, status: 'passed' }
}
</script>
