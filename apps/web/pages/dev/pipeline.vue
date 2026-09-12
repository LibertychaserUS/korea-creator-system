<template>
  <ScreenFrame testid="screen-b-pipeline" title="数据管道">
    <pre class="muted">{{ dump }}</pre>
  </ScreenFrame>
</template>
<script setup lang="ts">
const { request } = useApi()
const dump = ref('—')
onMounted(async () => {
  dump.value = JSON.stringify(await request('/api/dev/pipeline'), null, 2)
})
</script>
