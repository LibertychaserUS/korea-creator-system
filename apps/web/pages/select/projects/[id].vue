<template>
  <ScreenFrame testid="screen-c-project-board" :title="project.name || '项目工作台'" :data-project-id="id">
    <NuxtLink class="btn" data-testid="btn-open-library" :to="localePath(`/select/pool?project=${id}`)">从库选人</NuxtLink>
    <table>
      <tr
        v-for="row in project.assignments || []"
        :key="row.creatorId"
        data-testid="row-project-assignment"
        :data-creator-key="row.creatorKey"
      >
        <td>{{ row.displayName }}</td>
        <td>{{ row.status }}</td>
      </tr>
    </table>
  </ScreenFrame>
</template>

<script setup lang="ts">
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
