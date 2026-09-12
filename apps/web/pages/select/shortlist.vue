<template>
  <ScreenFrame testid="screen-c-shortlist" title="短名单">
    <pre class="muted">{{ dump }}</pre>
  </ScreenFrame>
</template>
<script setup lang="ts">
const { request } = useApi()
const dump = ref('—')
onMounted(async () => {
  dump.value = JSON.stringify(await request('/api/select/shortlist'), null, 2)
})
</script>
