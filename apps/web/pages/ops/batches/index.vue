<template>
  <ScreenFrame testid="screen-a-batch-list" :title="t('batch.listTitle')">
    <p>
      <NuxtLink class="btn" :to="localePath('/ops/batches/upload')">{{ t('navBatchUpload') }}</NuxtLink>
    </p>
    <table class="ledger-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>{{ t('batch.uploadTitle') }}</th>
          <th>status</th>
          <th>{{ t('home.cleaned') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.id">
          <td>
            <NuxtLink :to="localePath(`/ops/batches/${row.id}`)">{{ row.batch_name || row.batchName || row.id }}</NuxtLink>
          </td>
          <td>{{ row.file_name || row.fileName || row.source_name || row.sourceId }}</td>
          <td><span class="batch-status status-chip">{{ row.status }}</span></td>
          <td>{{ row.written_count ?? row.writtenCount }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="!items.length" class="muted">—</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { request } = useApi()
const items = ref<any[]>([])
onMounted(async () => {
  items.value = (await request<any>('/api/ops/batches')).items || []
})
</script>
