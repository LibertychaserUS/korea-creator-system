<template>
  <ScreenFrame testid="screen-c-project-board" :title="project.name || t('selectDesk.board')" :data-project-id="id">
    <div class="filters">
      <NuxtLink class="btn" data-testid="btn-open-library" :to="localePath(`/select/pool?project=${id}`)">{{ t('navPool') }}</NuxtLink>
    </div>
    <table class="ledger-table">
      <thead>
        <tr>
          <th>{{ t('selectDesk.board') }}</th>
          <th>status</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in project.assignments || []"
          :key="row.creatorId"
          data-testid="row-project-assignment"
          :data-creator-key="row.creatorKey"
        >
          <td>{{ row.displayName }}</td>
          <td>{{ row.status }}</td>
        </tr>
      </tbody>
    </table>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const id = computed(() => String(route.params.id))
const localePath = useLocalePath()
const { request } = useApi()
const project = ref<any>({ name: '', assignments: [] })
async function load() {
  project.value = await request(`/api/select/projects/${id.value}`)
}
onMounted(load)
</script>
