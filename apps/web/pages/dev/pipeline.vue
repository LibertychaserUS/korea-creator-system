<template>
  <ScreenFrame testid="screen-b-pipeline" :title="t('devDesk.pipeline')">
    <p class="muted">Excel → {{ t('batch.start') }} → {{ t('score.title') }} → AI → {{ t('publish') }}</p>
    <div class="pipeline-steps">
      <div class="pipe-stage">Excel<br /><strong>{{ pipe.jobs }}</strong></div>
      <div class="pipe-stage">{{ t('batch.start') }}<br /><strong>{{ pipe.sources }}</strong></div>
      <div class="pipe-stage">{{ t('score.title') }}<br /><strong>{{ pipe.review }}</strong></div>
      <div class="pipe-stage">AI<br /><strong>{{ pipe.review }}</strong></div>
      <div class="pipe-stage">{{ t('publish') }}<br /><strong>{{ pipe.released }}</strong></div>
    </div>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { request } = useApi()
const pipe = ref({ sources: 0, jobs: 0, review: 0, released: 0 })
onMounted(async () => {
  pipe.value = await request('/api/dev/pipeline')
})
</script>
