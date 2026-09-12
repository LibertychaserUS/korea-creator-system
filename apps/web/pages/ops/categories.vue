<template>
  <ScreenFrame testid="screen-ops-category" title="分类词表">
    <pre class="muted">{{ dump }}</pre>
  </ScreenFrame>
</template>
<script setup lang="ts">
const { request } = useApi()
const dump = ref('—')
onMounted(async () => {
  dump.value = JSON.stringify(await request('/api/ops/categories'), null, 2)
})
</script>
