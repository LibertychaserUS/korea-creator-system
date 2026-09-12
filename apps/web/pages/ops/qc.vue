<template>
  <ScreenFrame testid="screen-a-creator-qc" :title="t('qc.title')">
    <div class="qc-split">
      <aside class="qc-queue">
        <h2>{{ t('qc.queue') }} ({{ items.length }})</h2>
        <button
          v-for="row in items"
          :key="row.id"
          class="btn ghost"
          type="button"
          @click="current = row"
        >{{ row.displayName }}</button>
      </aside>
      <div>
        <table v-if="current" class="qc-compare ledger-table">
          <thead>
            <tr><th>field</th><th>value</th><th>QC</th></tr>
          </thead>
          <tbody>
            <tr><td>{{ current.displayName }}</td><td>{{ current.status }}</td><td>{{ current.followers ?? '—' }}</td></tr>
          </tbody>
        </table>
        <label v-if="current" class="field">
          note
          <input v-model="notes[current.id]" />
          <button class="btn ghost" type="button" @click="save(current.id)">save</button>
        </label>
        <p class="muted">{{ t('qc.note') }}</p>
        <p v-if="!items.length" class="muted">—</p>
      </div>
    </div>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { request } = useApi()
const items = ref<any[]>([])
const current = ref<any>(null)
const notes = reactive<Record<string, string>>({})
onMounted(async () => {
  items.value = (await request<any>('/api/ops/creators')).items || []
  for (const row of items.value) notes[row.id] = row.qcNotes || ''
  current.value = items.value[0] || null
})
async function save(id: string) {
  await request(`/api/ops/creators/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ qcNotes: notes[id] }),
  })
}
</script>
