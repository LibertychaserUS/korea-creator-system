<template>
  <ScreenFrame testid="screen-c-project-new" :title="t('selectDesk.newProject')">
    <form class="ledger-form" @submit.prevent="save">
      <label class="field inline">
        <span>{{ t('selectDesk.newProject') }}</span>
        <input v-model="name" data-testid="project-name" required />
      </label>
      <label class="field inline">
        <span>note</span>
        <textarea v-model="note" />
      </label>
      <button class="btn" data-testid="btn-create-project" type="submit" :disabled="!name">{{ t('createProject') }}</button>
    </form>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { request } = useApi()
const localePath = useLocalePath()
const name = ref('')
const note = ref('')
async function save() {
  const data = await request<{ id: string }>('/api/select/projects', {
    method: 'POST',
    body: JSON.stringify({ name: name.value, note: note.value }),
  })
  await navigateTo(localePath(`/select/projects/${data.id}`))
}
</script>
