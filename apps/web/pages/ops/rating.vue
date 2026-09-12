<template>
  <ScreenFrame testid="screen-a-score-preview" title="评分预览（只读）">
    <pre class="muted">{{ dump }}</pre>
  </ScreenFrame>
</template>
<script setup lang="ts">
const { request } = useApi()
const dump = ref('—')
onMounted(async () => {
  dump.value = JSON.stringify(await request('/api/ops/creators'), null, 2)
})
</script>
