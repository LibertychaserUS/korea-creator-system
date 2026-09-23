<template>
  <section>
    <p class="kcs-eyebrow">{{ t('kcs.overview.eyebrow') }}</p>
    <h1 class="kcs-title">{{ t('kcs.overview.title') }}</h1>
    <p class="kcs-lead">{{ t('kcs.overview.lead') }}</p>
  </section>
</template>

<script setup lang="ts">
const { t } = useI18n()
</script>
