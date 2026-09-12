<template>
  <ScreenFrame testid="screen-b-i18n-theme" title="语言 / 主题状态">
    <pre class="muted">{{ dump }}</pre>
  </ScreenFrame>
</template>
<script setup lang="ts">
const { request } = useApi()
const dump = ref('—')
onMounted(async () => {
  dump.value = JSON.stringify(await request('/api/dev/i18n-theme'), null, 2)
})
</script>
