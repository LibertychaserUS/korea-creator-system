<template>
  <ScreenFrame testid="screen-c-projects" :title="t('selectDesk.projects')">
    <NuxtLink class="btn" data-testid="btn-create-project" :to="localePath('/select/projects/new')">
      {{ t('createProject') }}
    </NuxtLink>
    <table class="ledger-table" data-testid="table-projects">
      <thead>
        <tr>
          <th>{{ t('selectDesk.projects') }}</th>
          <th>n</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.id">
          <td>
            <NuxtLink :to="localePath(`/select/projects/${row.id}`)">{{ row.name }}</NuxtLink>
          </td>
          <td>{{ row.member_count }}</td>
        </tr>
      </tbody>
    </table>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { request } = useApi()
const items = ref<any[]>([])

async function load() {
  items.value = (await request<any>('/api/select/projects')).items
}

onMounted(load)
</script>
