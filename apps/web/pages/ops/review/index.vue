<template>
  <ScreenFrame testid="screen-a-ai-queue" :title="t('ai.queue')">
    <p class="muted">{{ t('ai.lead') }}</p>
    <div class="ai-queue-metrics">
      <div class="metric-tile"><div class="muted">{{ t('home.review') }}</div><strong>{{ items.length }}</strong></div>
      <div class="metric-tile"><div class="muted">ok</div><strong>0</strong></div>
      <div class="metric-tile"><div class="muted">fallback</div><strong>0</strong></div>
      <div class="metric-tile"><div class="muted">fail</div><strong>0</strong></div>
    </div>
    <table class="ledger-table">
      <thead>
        <tr><th>name</th><th>risk</th><th>AI</th><th>status</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.id">
          <td>{{ row.display_name }}</td>
          <td>{{ row.risk_level }}</td>
          <td>{{ row.conclusion }}</td>
          <td><span class="status-chip">{{ row.status }}</span></td>
          <td>
            <NuxtLink class="btn ghost" :to="localePath(`/ops/review/${row.id}`)">查看结论</NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!items.length" class="muted">—</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { request } = useApi()
const items = ref<any[]>([])
onMounted(async () => {
  items.value = (await request<any>('/api/ops/review')).items || []
})
</script>
