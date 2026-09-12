<template>
  <ScreenFrame testid="screen-a-batch-upload" :title="t('batch.uploadTitle')">
    <p class="muted">{{ t('batch.uploadLead') }}</p>
    <label class="dropzone">
      <input class="sr-only" type="file" accept=".xlsx,.xls,.csv" @change="onFile" />
      <span>{{ t('batch.drop') }}</span>
    </label>
    <div v-if="file" class="batch-file">
      <span>{{ file.name }}</span>
      <span class="muted">{{ Math.round(file.size / 1024) }} KB</span>
    </div>
    <label class="field">
      {{ t('batch.listTitle') }}
      <input v-model="batchName" />
    </label>
    <button class="btn" type="button" :disabled="busy" @click="run">{{ t('batch.start') }}</button>
    <p v-if="result">{{ result.id }} · {{ result.status }} · {{ result.writtenCount ?? result.written_count }}</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { request } = useApi()
const file = ref<File | null>(null)
const batchName = ref('')
const result = ref<any>(null)
const busy = ref(false)

function onFile(ev: Event) {
  file.value = (ev.target as HTMLInputElement).files?.[0] || null
  if (file.value && !batchName.value) batchName.value = file.value.name.replace(/\.xlsx$/i, '')
}

async function run() {
  busy.value = true
  try {
    if (file.value) {
      const body = new FormData()
      body.append('file', file.value)
      if (batchName.value) body.append('batchName', batchName.value)
      result.value = await request('/api/ops/batches', { method: 'POST', body })
    } else {
      result.value = await request('/api/ops/batches', { method: 'POST' })
    }
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
