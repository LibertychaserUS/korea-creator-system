<template>
  <ScreenFrame testid="screen-a-human-label" :title="t('label.title')">
    <div v-for="row in items" :key="row.id" class="panel ledger-2">
      <div>
        <h2>{{ row.displayName }}</h2>
        <div class="label-choice filters">
          <button class="btn ghost" type="button" @click="label(row.id, 'recommended')">{{ t('label.recommend') }}</button>
          <button class="btn ghost" type="button" @click="label(row.id, 'rejected')">{{ t('label.reject') }}</button>
          <button class="btn ghost" type="button" @click="label(row.id, 'pending')">{{ t('label.pending') }}</button>
        </div>
        <p>{{ row.label || '—' }} · {{ row.status }}</p>
      </div>
      <div class="score-lock">
        <div class="muted">{{ t('label.locked') }} / 规则分</div>
        <strong>{{ row.rating ?? '—' }}</strong>
      </div>
    </div>
    <p v-if="!items.length" class="muted">—</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { request } = useApi()
const items = ref<any[]>([])
async function load() {
  items.value = (await request<any>('/api/ops/creators')).items || []
}
onMounted(load)
async function label(id: string, next: string) {
  await request(`/api/ops/creators/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ label: next }),
  })
  await load()
}
</script>
