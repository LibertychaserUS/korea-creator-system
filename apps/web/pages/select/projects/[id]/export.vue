<template>
  <ScreenFrame testid="screen-c-export" title="导出项目名单">
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
