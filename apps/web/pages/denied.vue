<template>
  <section data-testid="screen-denied">
    <h1>{{ t('denied') }}</h1>
    <p class="muted">当前角色看不到这份库存或失败栈。</p>
    <NuxtLink class="btn" :to="localePath('/')">回自己的工作区</NuxtLink>
  </section>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
</script>
