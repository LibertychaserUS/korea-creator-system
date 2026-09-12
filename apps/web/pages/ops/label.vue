<template>
  <ScreenFrame testid="screen-a-human-label" title="人工推荐 / 不推荐">
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
