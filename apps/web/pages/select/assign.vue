<template>
  <ScreenFrame testid="screen-c-assign" :title="t('selectDesk.assign')">
    <div class="assign-dialog">
      <p>{{ t('selectDesk.assign') }} · {{ ids.length }}</p>
      <label class="field">{{ t('selectDesk.assign') }}
        <select v-model="projectId">
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <button class="btn" data-testid="select-assign-confirm" type="button" :disabled="!ids.length || !projectId" @click="confirm">
        {{ t('assign') }}
      </button>
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
onMounted(async () => {
  projects.value = (await request<any>('/api/select/projects')).items
  if (!projectId.value && projects.value[0]) projectId.value = projects.value[0].id
})
async function confirm() {
  await request(`/api/select/projects/${projectId.value}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ creatorIds: ids.value }),
  })
  await navigateTo(localePath(`/select/projects/${projectId.value}`))
}
</script>
