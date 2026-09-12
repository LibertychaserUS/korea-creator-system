<template>
  <PanelPage testid="screen-c-project-new" :title="t('kcs.panel.createProject')" :eyebrow="t('kcs.nav.select')">
    <Card class="max-w-xl">
      <CardContent class="pt-6">
        <form class="grid gap-4" @submit.prevent="save">
          <div class="grid gap-2">
            <Label>{{ t('kcs.panel.projectName') }}</Label>
            <Input v-model="name" data-testid="project-name" required />
          </div>
          <div class="grid gap-2">
            <Label>{{ t('kcs.panel.note') }}</Label>
            <Textarea v-model="note" />
          </div>
          <Button data-testid="btn-create-project" type="submit" :disabled="!name">
            {{ t('kcs.panel.createProject') }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </PanelPage>
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
  await navigateTo(localePath(`/projects/${data.id}`))
}
</script>
