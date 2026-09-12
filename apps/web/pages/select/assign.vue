<template>
  <ScreenFrame testid="screen-c-assign" :title="t('selectDesk.pool')">
    <div class="assign-overlay">
      <div class="assign-backdrop" aria-hidden="true">
        <table class="ledger-table">
          <thead>
            <tr>
              <th>{{ t('col.name') }}</th>
              <th>{{ t('col.followers') }}</th>
              <th>{{ t('col.quote') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pool" :key="row.id">
              <td>{{ row.displayName }}</td>
              <td>{{ row.followers }}</td>
              <td>{{ row.price?.amountMin ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="assign-modal-layer">
        <div class="assign-dialog">
          <h2>{{ t('selectDesk.assign') }}</h2>
          <p class="muted">{{ t('selectDesk.selected') }} · {{ ids.length }}</p>
          <div class="filter-chips">
            <span v-for="name in selectedNames" :key="name" class="status-chip">{{ name }}</span>
          </div>
          <label class="field">{{ t('selectDesk.targetProject') }}
            <select v-model="projectId">
              <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </label>
          <label class="field">{{ t('selectDesk.assignNote') }}
            <textarea v-model="note" maxlength="200" rows="3" />
          </label>
          <label class="field inline">
            <input v-model="alsoShortlist" type="checkbox" />
            <span>{{ t('selectDesk.alsoShortlist') }}</span>
          </label>
          <p class="muted">{{ t('score.locked') }}</p>
          <div class="filters">
            <button class="btn" data-testid="select-assign-confirm" type="button" :disabled="!ids.length || !projectId" @click="confirm">
              {{ t('assign') }}
            </button>
            <button class="btn ghost" type="button" @click="cancel">{{ t('selectDesk.cancel') }}</button>
          </div>
        </div>
      </div>
    </div>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const { request } = useApi()
const ids = computed(() => String(route.query.ids || '').split(',').filter(Boolean))
const projectId = ref(String(route.query.project || ''))
const projects = ref<any[]>([])
const pool = ref<any[]>([])
const note = ref('')
const alsoShortlist = ref(true)
const selectedNames = computed(() => {
  const wanted = new Set(ids.value)
  return pool.value.filter((row) => wanted.has(row.id)).map((row) => row.displayName)
})
onMounted(async () => {
  const [projectBody, poolBody] = await Promise.all([
    request<any>('/api/select/projects'),
    request<any>('/api/select/pool'),
  ])
  projects.value = projectBody.items
  pool.value = poolBody.items || []
  if (!projectId.value && projects.value[0]) projectId.value = projects.value[0].id
})
async function confirm() {
  await request(`/api/select/projects/${projectId.value}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ creatorIds: ids.value, note: note.value || undefined }),
  })
  if (alsoShortlist.value) {
    for (const creatorId of ids.value) {
      await request('/api/select/shortlist', {
        method: 'POST',
        body: JSON.stringify({ creatorId }),
      })
    }
  }
  await navigateTo(localePath(`/select/projects/${projectId.value}`))
}
async function cancel() {
  const project = String(route.query.project || projectId.value || '')
  await navigateTo(localePath(project ? `/select/pool?project=${project}` : '/select/pool'))
}
</script>
