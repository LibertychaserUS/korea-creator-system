<template>
  <Card
    class="relative gap-0 overflow-hidden border-border/60 py-0 shadow-xs transition-shadow hover:shadow-sm"
    :data-testid="testid"
  >
    <span class="absolute inset-y-0 left-0 w-1" :class="accentClass" aria-hidden="true" />
    <div class="flex items-start justify-between gap-3 p-4 pl-5 sm:p-5 sm:pl-6">
      <div class="min-w-0">
        <p class="truncate text-xs font-medium text-muted-foreground">{{ label }}</p>
        <p class="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground md:text-3xl">
          <slot>{{ value }}</slot>
        </p>
        <p v-if="hint" class="mt-1 truncate text-xs text-muted-foreground/80">{{ hint }}</p>
      </div>
      <span
        v-if="icon"
        class="flex size-9 shrink-0 items-center justify-center rounded-lg"
        :class="iconWrapClass"
        aria-hidden="true"
      >
        <component :is="icon" class="size-4" />
      </span>
    </div>
  </Card>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

/** KPI 瓦片：左侧一道色条标记语义，右上角图标，数字用等宽数字对齐。 */
const props = withDefaults(
  defineProps<{
    label: string
    value?: string | number
    hint?: string
    icon?: Component
    tone?: 'sea' | 'sand' | 'moss' | 'ink' | 'coral'
    testid?: string
  }>(),
  { tone: 'sea' },
)

const TONES = {
  sea: { bar: 'bg-primary', wrap: 'bg-primary/10 text-primary' },
  sand: { bar: 'bg-amber-500/80', wrap: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  moss: { bar: 'bg-emerald-500/80', wrap: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  ink: { bar: 'bg-foreground/50', wrap: 'bg-muted text-muted-foreground' },
  coral: { bar: 'bg-destructive/80', wrap: 'bg-destructive/10 text-destructive' },
} as const

const accentClass = computed(() => TONES[props.tone].bar)
const iconWrapClass = computed(() => TONES[props.tone].wrap)
</script>
