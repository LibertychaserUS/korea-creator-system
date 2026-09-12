<template>
  <ScreenFrame testid="screen-a-publish" :title="t('pub.title')">
    <div class="panel publish-preview">
      <h2>{{ t('pub.preview') }} · {{ t('pub.title') }}</h2>
      <table class="ledger-table">
        <tbody>
        <tr v-for="row in items" :key="row.id" :class="{ strike: row.label === 'rejected' }">
          <td>{{ row.displayName }}</td>
          <td>{{ row.rating ?? '—' }}</td>
          <td>{{ row.status }}</td>
          <td>
            <button class="btn" data-testid="btn-publish" type="button" @click="publish(row.id)">{{ t('publish') }}</button>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { request } = useApi()
const items = ref<any[]>([])
onMounted(async () => {
  items.value = (await request<any>('/api/ops/creators')).items
})
async function publish(id: string) {
  await request(`/api/ops/creators/${id}/publish`, { method: 'POST' })
  items.value = (await request<any>('/api/ops/creators')).items
}
</script>
