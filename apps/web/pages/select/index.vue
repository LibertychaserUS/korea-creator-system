<template>
  <ScreenFrame testid="screen-c-projects" title="项目列表">
    <button class="btn" data-testid="btn-create-project" type="button" @click="onCreate">
      {{ creating ? '确认创建' : '新建项目' }}
    </button>
    <label v-if="creating" class="field">
      名称
      <input v-model="name" data-testid="project-name" />
    </label>
    <table data-testid="table-projects">
      <tr v-for="row in items" :key="row.id">
        <td>
          <NuxtLink :to="localePath(`/select/projects/${row.id}`)">{{ row.name }}</NuxtLink>
        </td>
        <td>{{ row.member_count }}</td>
      </tr>
    </table>
  </ScreenFrame>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const { request } = useApi()
const items = ref<any[]>([])
const creating = ref(false)
const name = ref('')

async function load() {
  items.value = (await request<any>('/api/select/projects')).items
}

async function onCreate() {
  if (!creating.value) {
    creating.value = true
    return
  }
  const data = await request<{ id: string }>('/api/select/projects', {
    method: 'POST',
    body: JSON.stringify({ name: name.value }),
  })
  await navigateTo(localePath(`/select/projects/${data.id}`))
}

onMounted(load)
</script>
