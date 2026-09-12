<template>
  <ScreenFrame testid="screen-a-ai-detail" :title="`${t('ai.detail')} · ${id}`">
    <div v-if="item.id" class="ledger-2">
      <div class="panel">
        <p>{{ item.display_name }}</p>
        <p>{{ item.risk_level }}</p>
        <p>{{ item.conclusion }}</p>
        <p>{{ item.status }}</p>
        <p class="muted">{{ t('score.locked') }} · 不改分</p>
        <button v-if="item.status === 'pending'" class="btn" type="button" @click="pass">{{ t('navReview') }}</button>
      </div>
      <div class="score-lock">
        <div class="muted">{{ t('ai.locked') }} / 分数锁定</div>
        <strong>{{ item.rating ?? '—' }}</strong>
        <p>{{ t('score.locked') }}</p>
      </div>
    </div>
    <p v-else class="muted">—</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
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
