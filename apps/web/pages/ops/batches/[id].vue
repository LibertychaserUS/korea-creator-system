<template>
  <ScreenFrame testid="screen-a-batch-clean" :title="`${t('batch.cleanTitle')} · ${job.batch_name || job.batchName || job.id || id}`">
    <p class="muted">{{ job.source_name }} · {{ job.file_name || job.fileName }} · {{ job.status }}</p>
    <div class="pipeline-steps">
      <span>Excel</span> → <span>{{ t('batch.start') }}</span> → <span>{{ t('score.title') }}</span> → <span>{{ t('pub.title') }}</span>
    </div>
    <div class="clean-progress progress-bar" :title="progress + '%'">
      <i :style="{ width: progress + '%' }" />
    </div>
    <div class="cards">
      <div class="card"><div class="muted">{{ t('home.cleaned') }}</div><strong>{{ job.written_count ?? job.writtenCount ?? 0 }}</strong></div>
      <div class="card"><div class="muted">dup</div><strong>{{ job.skipped_dupes ?? job.skippedDupes ?? 0 }}</strong></div>
      <div class="card"><div class="muted">fail</div><strong>{{ job.failed_count ?? job.failedCount ?? 0 }}</strong></div>
      <div class="card"><div class="muted">rows</div><strong>{{ job.source_rows ?? job.sourceRows ?? 0 }}</strong></div>
    </div>
    <p v-if="job.error_summary" class="err">{{ job.error_summary }}</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const id = computed(() => String(route.params.id))
const { request } = useApi()
const job = ref<any>({})
const progress = computed(() => {
  if (job.value.status === 'ok') return 100
  if (job.value.status === 'running') return 62
  return 20
})
onMounted(async () => {
  const data = await request<any>('/api/ops/batches')
  job.value = (data.items || []).find((row: any) => String(row.id) === id.value) || { id: id.value }
})
</script>
