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
        <table class="qc-compare ledger-table">
          <thead>
            <tr>
              <th>{{ t('qc.field') }}</th>
              <th>{{ t('qc.excel') }}</th>
              <th>{{ t('qc.proofed') }}</th>
              <th>{{ t('qc.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pair in current ? pairs(current) : []" :key="pair.field">
              <td>{{ pair.field }}</td>
              <td>{{ pair.excel }}</td>
              <td>{{ pair.proofed }}</td>
              <td>{{ pair.ok ? t('qc.ok') : t('qc.missing') }}</td>
            </tr>
          </tbody>
        </table>
        <label v-if="current" class="field">
          {{ t('qc.noteField') }}
          <input v-model="notes[current.id]" />
          <button class="btn ghost" type="button" @click="save(current.id)">{{ t('qc.confirm') }}</button>
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
function cell(value: unknown) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '—'
  return Array.isArray(value) ? value.join(' / ') : String(value)
}
function pairs(row: any) {
  const fields = [
    { field: t('col.followers'), excel: row.followers, proofed: row.followers },
    { field: t('col.quote'), excel: row.price?.amountMin, proofed: row.price?.amountMin },
    { field: t('qc.xhs'), excel: row.xhsId, proofed: row.xhsId },
    { field: t('col.region'), excel: row.regions, proofed: row.regions },
  ]
  return fields.map((f) => {
    const excel = cell(f.excel)
    const proofed = cell(f.proofed)
    return { field: f.field, excel, proofed, ok: excel !== '—' && proofed !== '—' }
  })
}
async function save(id: string) {
  await request(`/api/ops/creators/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ qcNotes: notes[id] }),
  })
}
</script>
