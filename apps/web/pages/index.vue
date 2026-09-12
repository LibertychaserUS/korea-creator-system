<template>
  <section>
    <h1>{{ t('brand') }}</h1>
    <p class="muted">纸面账本 · 选人与分配</p>
    <p>
      <NuxtLink class="btn" :to="localePath('/login')">{{ t('login') }}</NuxtLink>
    </p>
  </section>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
</script>
