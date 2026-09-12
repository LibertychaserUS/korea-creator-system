<template>
  <ScreenFrame testid="screen-c-project-new" title="新建项目">
    <form @submit.prevent="save">
      <label class="field">名称<input v-model="name" data-testid="project-name" required /></label>
      <label class="field">备注<textarea v-model="note" /></label>
      <button class="btn" data-testid="btn-create-project" type="submit" :disabled="!name">创建</button>
    </form>
  </ScreenFrame>
</template>

<script setup lang="ts">
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
