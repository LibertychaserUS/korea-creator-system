<template>
  <ScreenFrame testid="screen-b-pipeline" title="数据管道">
    <p class="muted">Excel → 清洗 → 评分 → AI → 发布</p>
    <div class="cards">
      <div class="card"><div class="muted">启用源</div><strong>{{ pipe.sources }}</strong></div>
      <div class="card"><div class="muted">任务</div><strong>{{ pipe.jobs }}</strong></div>
      <div class="card"><div class="muted">待复核</div><strong>{{ pipe.review }}</strong></div>
      <div class="card"><div class="muted">已发布</div><strong>{{ pipe.released }}</strong></div>
    </div>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { request } = useApi()
const pipe = ref({ sources: 0, jobs: 0, review: 0, released: 0 })
onMounted(async () => {
  pipe.value = await request('/api/dev/pipeline')
})
</script>
