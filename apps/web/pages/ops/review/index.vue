<template>
  <ScreenFrame testid="screen-a-ai-queue" title="风险复核队列">
    <pre class="muted">{{ dump }}</pre>
  </ScreenFrame>
</template>
<script setup lang="ts">
const { request } = useApi()
const dump = ref('—')
onMounted(async () => {
  dump.value = JSON.stringify(await request('/api/ops/review'), null, 2)
})
</script>
