<template>
  <div class="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center" :data-testid="testid">
    <span class="tide-empty relative flex size-12 items-center justify-center rounded-full text-primary" aria-hidden="true">
      <component :is="icon ?? Waves" class="size-5" />
    </span>
    <div class="max-w-sm">
      <p class="text-sm font-medium text-foreground">{{ title }}</p>
      <p v-if="body" class="mt-1 text-sm leading-relaxed text-muted-foreground">{{ body }}</p>
    </div>
    <div v-if="$slots.default" class="mt-1 flex flex-wrap items-center justify-center gap-2">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Waves } from 'lucide-vue-next'
import type { Component } from 'vue'

defineProps<{
  title: string
  body?: string
  icon?: Component
  testid?: string
}>()
</script>

<style scoped>
/* 空态图标外圈：两道极浅的同心涟漪，颜色从主题 token 派生 */
.tide-empty {
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  box-shadow:
    0 0 0 8px color-mix(in srgb, var(--primary) 5%, transparent),
    0 0 0 16px color-mix(in srgb, var(--primary) 2.5%, transparent);
}
</style>
