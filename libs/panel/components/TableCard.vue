<template>
  <Card class="gap-0 overflow-hidden border-border/60 py-0 shadow-xs" :data-testid="testid">
    <div
      v-if="title || $slots.actions || $slots.meta"
      class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5 sm:px-5"
    >
      <div class="min-w-0">
        <h2 v-if="title" class="text-sm font-semibold tracking-tight text-foreground">{{ title }}</h2>
        <p v-if="description" class="mt-0.5 text-xs text-muted-foreground">{{ description }}</p>
      </div>
      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        <slot name="meta" />
        <slot name="actions" />
      </div>
    </div>
    <div class="overflow-x-auto [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:text-xs sm:[&_td]:px-5 sm:[&_th]:px-5">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-border/60 px-4 py-3.5 sm:px-5">
      <slot name="footer" />
    </div>
  </Card>
</template>

<script setup lang="ts">
/** 数据表卡：标题栏 + 贴边表格 + 可选底栏，表格单元格统一留白。 */
defineProps<{
  title?: string
  description?: string
  testid?: string
}>()
</script>
