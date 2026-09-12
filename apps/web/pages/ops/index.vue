<template>
  <ScreenFrame testid="screen-a-home" title="运营工作台">
    <div class="cards">
      <div class="card"><div class="muted">待录入</div><strong>{{ counts.draft }}</strong></div>
      <div class="card"><div class="muted">待复核</div><strong>{{ counts.review }}</strong></div>
      <div class="card"><div class="muted">可发布</div><strong>{{ counts.ready }}</strong></div>
      <div class="card"><div class="muted">已发布</div><strong>{{ counts.released }}</strong></div>
    </div>
    <p>
      <NuxtLink class="btn" data-testid="btn-create-creator" :to="localePath('/ops/creators/new')">录入达人</NuxtLink>
    </p>
    <div class="panel">
      <h2>近期任务</h2>
      <table>
        <tr v-for="job in jobs" :key="job.id"><td>{{ job.id }}</td><td>{{ job.status }}</td><td>{{ job.written_count }}</td></tr>
      </table>
    </div>
  </ScreenFrame>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const { request } = useApi()
const counts = ref({ draft: 0, review: 0, ready: 0, released: 0 })
const jobs = ref<any[]>([])
onMounted(async () => {
  const data = await request<any>('/api/ops/overview')
  counts.value = data.counts
  jobs.value = data.recentJobs
})
</script>
