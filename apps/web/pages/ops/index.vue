<template>
  <ScreenFrame testid="screen-a-home" :title="t('home.title')">
    <div class="ledger-metrics">
      <div class="metric-tile"><div class="muted">{{ t('home.draft') }}</div><strong>{{ counts.draft }}</strong></div>
      <div class="metric-tile"><div class="muted">{{ t('home.review') }}</div><strong>{{ counts.review }}</strong></div>
      <div class="metric-tile"><div class="muted">{{ t('home.cleaned') }}</div><strong>{{ counts.ready }}</strong></div>
      <div class="metric-tile"><div class="muted">{{ t('home.ready') }}</div><strong>{{ counts.released }}</strong></div>
    </div>
    <p>
      <NuxtLink class="btn" data-testid="btn-create-creator" :to="localePath('/ops/creators/new')">{{ t('createCreator') }}</NuxtLink>
    </p>
    <div class="home-grid">
      <div class="panel">
        <h2>{{ t('home.recentBatches') }}</h2>
        <table class="ledger-table">
          <thead>
            <tr><th>ID</th><th>{{ t('home.cleaned') }}</th><th>status</th></tr>
          </thead>
          <tbody>
            <tr v-for="job in jobs" :key="job.id">
              <td>
                <NuxtLink :to="localePath(`/ops/batches/${job.id}`)">{{ job.id }}</NuxtLink>
              </td>
              <td>{{ job.written_count }}</td>
              <td><span class="status-chip">{{ job.status }}</span></td>
            </tr>
          </tbody>
        </table>
        <p>
          <NuxtLink :to="localePath('/ops/batches')">{{ t('home.viewBatches') }}</NuxtLink>
        </p>
      </div>
      <div class="panel">
        <h2>{{ t('home.todos') }}</h2>
        <p>{{ counts.review }} {{ t('navQc') }}</p>
        <p>{{ counts.review }} {{ t('navReview') }}</p>
        <p>{{ counts.draft }} {{ t('home.draft') }}</p>
      </div>
    </div>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
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
