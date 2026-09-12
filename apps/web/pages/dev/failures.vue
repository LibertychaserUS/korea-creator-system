<template>
  <ScreenFrame testid="screen-b-failures" title="失败与重试">
    <pre class="muted">{{ dump }}</pre>
  </ScreenFrame>
</template>
<script setup lang="ts">
const { request } = useApi()
const dump = ref('—')
onMounted(async () => {
  dump.value = JSON.stringify(await request('/api/dev/failures'), null, 2)
})
</script>
