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
/* 空态图标外圈：两道极浅的同心涟漪 */
.tide-empty {
  background: oklch(0.45 0.085 235 / 0.08);
  box-shadow:
    0 0 0 8px oklch(0.45 0.085 235 / 0.05),
    0 0 0 16px oklch(0.45 0.085 235 / 0.025);
}
</style>
