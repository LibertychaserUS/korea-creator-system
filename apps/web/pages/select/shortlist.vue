<template>
  <ScreenFrame testid="screen-c-shortlist" title="短名单">
    <table>
      <thead>
        <tr><th>达人</th><th>加入时间</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="`${row.org_id}-${row.creator_id}`">
          <td>{{ row.display_name }}</td>
          <td>{{ row.added_at }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="!items.length" class="muted">短名单还是空的</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { request } = useApi()
const items = ref<any[]>([])
onMounted(async () => {
  items.value = (await request<any>('/api/select/shortlist')).items || []
})
</script>
