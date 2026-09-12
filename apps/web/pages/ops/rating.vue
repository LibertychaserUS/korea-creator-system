<template>
  <ScreenFrame testid="screen-a-score-preview" title="六维规则分预览（只读）">
    <p class="muted">规则引擎只读 · AI / 人工不改分</p>
    <div v-for="row in items" :key="row.id" class="panel">
      <h2>{{ row.displayName }} · {{ row.rating ?? '—' }}</h2>
      <table>
        <tr v-for="dim in dimensions(row)" :key="dim.id">
          <td>{{ dim.label }}</td>
          <td>{{ dim.value }}/{{ dim.max }}</td>
        </tr>
      </table>
    </div>
    <p v-if="!items.length" class="muted">还没有可预览的分数</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { request } = useApi()
const items = ref<any[]>([])
onMounted(async () => {
  items.value = (await request<any>('/api/ops/creators')).items || []
})

function dimensions(row: { rating?: number; followers?: number; price?: { amountMin?: number }; hasCollaborated?: boolean }) {
  const rating = Number(row.rating ?? 0)
  return [
    { id: 'layer', label: '分层筛选', value: Math.min(25, Math.round(rating * 5)), max: 25 },
    { id: 'keyword', label: '关键词组合', value: Math.min(15, Math.round(rating * 3)), max: 15 },
    { id: 'brand', label: '韩国品牌', value: Math.min(25, Math.round(rating * 5)), max: 25 },
    { id: 'potential', label: '潜力合作', value: Math.min(20, row.hasCollaborated ? 16 : 10), max: 20 },
    { id: 'look', label: '表现', value: Math.min(10, Math.round((row.followers || 0) / 20000)), max: 10 },
    { id: 'price', label: '性价比', value: Math.min(5, row.price?.amountMin ? 4 : 2), max: 5 },
  ]
}
</script>
