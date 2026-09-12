<template>
  <ScreenFrame testid="screen-a-batch-upload" title="配置入库任务">
    <label class="field">来源
      <select v-model="sourceId">
        <option v-for="s in sources" :key="s.id" :value="s.id" :disabled="!s.enabled">{{ s.name }}</option>
      </select>
    </label>
    <label class="field">周期
      <select v-model="schedule">
        <option value="once">一次</option>
        <option value="0 9 * * *">每日</option>
      </select>
    </label>
    <button class="btn" type="button" :disabled="!sourceId" @click="create">确认开跑</button>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { request } = useApi()
const localePath = useLocalePath()
const sources = ref<any[]>([])
const sourceId = ref('')
const schedule = ref('once')
onMounted(async () => {
  sources.value = (await request<any>('/api/ingest/sources')).items
  sourceId.value = sources.value.find((s) => s.enabled)?.id || ''
})
async function create() {
  const job = await request<{ id: string }>('/api/ingest/jobs', {
    method: 'POST',
    body: JSON.stringify({ sourceId: sourceId.value, schedule: schedule.value, sampleRate: 0.1 }),
  })
  await navigateTo(localePath(`/ingest/jobs/${job.id}`))
}
</script>
