<template>
  <ScreenFrame testid="screen-c-export" :title="t('selectDesk.export')">
    <label class="field">
      {{ t('selectDesk.projects') }}
      <select v-model="projectId">
        <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </label>
    <div class="export-scope">
      <span>{{ t('selectDesk.export') }} · 范围</span>
      <label><input type="radio" checked /> {{ t('selectDesk.board') }}</label>
      <label><input type="radio" disabled /> {{ t('selectDesk.shortlist') }}</label>
    </div>
    <p class="muted">Excel .xlsx / CSV</p>
    <button class="btn" type="button" :disabled="!projectId" @click="download">CSV</button>
    <pre v-if="csv" class="panel">{{ csv }}</pre>
    <a v-if="href" class="btn ghost" :href="href" download="project.csv">CSV</a>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { request } = useApi()
const projects = ref<any[]>([])
const projectId = ref('')
const csv = ref('')
const href = ref('')
onMounted(async () => {
  projects.value = (await request<any>('/api/select/projects')).items || []
  if (projects.value[0]) projectId.value = projects.value[0].id
})
async function download() {
  const config = useRuntimeConfig()
  const token = useCookie<string | null>('kcs_session')
  const res = await fetch(`${config.public.apiBase}/api/select/projects/${projectId.value}/export`, {
    credentials: 'include',
    headers: token.value ? { authorization: `Bearer ${token.value}` } : {},
  })
  csv.value = await res.text()
  href.value = URL.createObjectURL(new Blob([csv.value], { type: 'text/csv;charset=utf-8' }))
}
</script>
