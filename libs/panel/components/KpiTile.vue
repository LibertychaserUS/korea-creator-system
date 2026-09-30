<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    :class="to ? 'group/tile block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50' : 'contents'"
    :data-testid="to ? testid : undefined"
  >
    <Card
      class="relative h-full gap-0 overflow-hidden border-border/60 py-0 shadow-xs transition-shadow hover:shadow-sm"
      :class="[to ? 'group-hover/tile:border-primary/30' : '', TONES[props.tone].toneClass]"
      :data-testid="to ? undefined : testid"
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
        <div class="flex shrink-0 items-start gap-1.5">
          <span
            v-if="icon"
            class="flex size-9 items-center justify-center rounded-lg"
            :class="iconWrapClass"
            aria-hidden="true"
          >
            <component :is="icon" class="size-4" />
          </span>
          <span
            v-if="to"
            class="flex size-9 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all duration-200 group-hover/tile:translate-x-0.5 group-hover/tile:text-primary group-hover/tile:opacity-100"
            aria-hidden="true"
          >
            <ArrowRight class="size-4" />
          </span>
        </div>
      </div>
    </Card>
  </component>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { ArrowRight } from 'lucide-vue-next'
import { NuxtLink } from '#components'

/** KPI 瓦片：左侧一道色条标记语义，右上角图标，数字用等宽数字对齐；给了 to 就整块可点。 */
const props = withDefaults(
  defineProps<{
    label: string
    value?: string | number
    hint?: string
    icon?: Component
    tone?: 'sea' | 'sand' | 'moss' | 'ink' | 'coral'
    testid?: string
    to?: string
  }>(),
  { tone: 'sea' },
)

/**
 * sand 走 --warning token（语义=需关注，与 ops 概览一致）、moss 走 --chart-* token
 *（color-mix 派生），换主题时跟随色板；sea / ink / coral 用语义色，与主题无关。
 */
const TONES = {
  sea: { bar: 'bg-primary', wrap: 'bg-primary/10 text-primary', toneClass: '' },
  sand: {
    bar: 'bg-(--tone-bar)',
    wrap: 'bg-(--tone-bg) text-(--tone-fg)',
    toneClass: 'kpi-tone-sand',
  },
  moss: {
    bar: 'bg-(--tone-bar)',
    wrap: 'bg-(--tone-bg) text-(--tone-fg)',
    toneClass: 'kpi-tone-moss',
  },
  ink: { bar: 'bg-foreground/50', wrap: 'bg-muted text-muted-foreground', toneClass: '' },
  coral: { bar: 'bg-destructive/80', wrap: 'bg-destructive/10 text-destructive', toneClass: '' },
} as const

const accentClass = computed(() => TONES[props.tone].bar)
const iconWrapClass = computed(() => TONES[props.tone].wrap)
</script>

<style scoped>
.kpi-tone-sand {
  --tone-bar: color-mix(in oklab, var(--warning) 85%, transparent);
  --tone-bg: color-mix(in oklab, var(--warning) 15%, transparent);
  --tone-fg: color-mix(in oklab, var(--warning) 55%, var(--foreground));
}

.kpi-tone-moss {
  --tone-bar: color-mix(in oklab, var(--chart-2) 85%, transparent);
  --tone-bg: var(--chart-2-bg-15);
  --tone-fg: color-mix(in oklab, var(--chart-2) 55%, var(--foreground));
}
</style>
