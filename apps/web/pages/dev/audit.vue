<template>
  <ScreenFrame testid="screen-b-audit" title="操作审计">
    <pre class="muted">{{ dump }}</pre>
  </ScreenFrame>
</template>
<script setup lang="ts">
const { request } = useApi()
const dump = ref('—')
onMounted(async () => {
  dump.value = JSON.stringify(await request('/api/dev/audit'), null, 2)
})
</script>
