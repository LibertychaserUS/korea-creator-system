<template>
  <ScreenFrame testid="screen-a-batch-list" title="已登记来源">
    <pre class="muted">{{ dump }}</pre>
  </ScreenFrame>
</template>
<script setup lang="ts">
const { request } = useApi()
const dump = ref('—')
onMounted(async () => {
  dump.value = JSON.stringify(await request('/api/ingest/sources'), null, 2)
})
</script>
