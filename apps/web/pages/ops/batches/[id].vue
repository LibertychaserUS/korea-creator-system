<template>
  <ScreenFrame testid="screen-a-batch-clean" :title="`清洗进度与去重 · ${job.id || id}`">
    <p class="muted">{{ job.source_name }} · {{ job.status }}</p>
    <div class="cards">
      <div class="card"><div class="muted">写入</div><strong>{{ job.written_count ?? 0 }}</strong></div>
      <div class="card"><div class="muted">去重</div><strong>{{ job.skipped_dupes ?? 0 }}</strong></div>
      <div class="card"><div class="muted">失败</div><strong>{{ job.failed_count ?? 0 }}</strong></div>
      <div class="card"><div class="muted">尝试</div><strong>{{ job.attempt ?? 0 }}</strong></div>
    </div>
    <div class="panel">
      <h2>管道</h2>
      <p>Excel 读入 → 字段标准化 → 去重 → 规则评分 → 待发布</p>
      <p v-if="job.error_summary" class="err">{{ job.error_summary }}</p>
    </div>
  </ScreenFrame>
</template>

<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id))
const { request } = useApi()
const job = ref<any>({})
onMounted(async () => {
  const data = await request<any>('/api/ops/batches')
  job.value = (data.items || []).find((row: any) => String(row.id) === id.value) || { id: id.value }
})
</script>
