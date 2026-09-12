<template>
  <ScreenFrame testid="screen-a-ai-detail" title="单条风险结论">
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
