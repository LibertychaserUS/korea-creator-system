<template>
  <ScreenFrame testid="screen-a-batch-list" title="批次列表">
    <pre class="muted">{{ dump }}</pre>
  </ScreenFrame>
</template>
<script setup lang="ts">
const { request } = useApi()
const dump = ref('—')
onMounted(async () => {
  dump.value = JSON.stringify(await request('/api/ops/batches'), null, 2)
})
</script>
