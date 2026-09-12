<template>
  <section data-testid="screen-denied">
    <h1>{{ t('denied') }}</h1>
    <p class="muted">{{ t('denied') }}</p>
    <NuxtLink class="btn" :to="localePath('/')">{{ t('ops') }}</NuxtLink>
  </section>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
</script>
