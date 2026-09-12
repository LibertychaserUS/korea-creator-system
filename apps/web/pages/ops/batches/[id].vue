<template>
  <ScreenFrame testid="screen-a-batch-clean" title="清洗进度与去重">
    <pre class="muted">{{ dump }}</pre>
  </ScreenFrame>
</template>
<script setup lang="ts">
const { request } = useApi()
const dump = ref('—')
onMounted(async () => {
  dump.value = 'ok'
})
</script>
