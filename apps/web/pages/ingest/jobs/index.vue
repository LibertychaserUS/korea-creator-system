<template>
  <ScreenFrame testid="screen-b-jobs" title="入库任务">
    <pre class="muted">{{ dump }}</pre>
  </ScreenFrame>
</template>
<script setup lang="ts">
const { request } = useApi()
const dump = ref('—')
onMounted(async () => {
  dump.value = JSON.stringify(await request('/api/ingest/jobs'), null, 2)
})
</script>
