<template>
  <div v-if="hints.length" class="border-t border-border/60 px-5 py-3" data-testid="trend-hints">
    <p class="text-xs font-medium">{{ t('kcs.creators.trendHints') }}</p>
    <ul class="mt-1.5 space-y-1">
      <li v-for="(hint, i) in hints" :key="`${hint.kind}-${hint.source}-${i}`" class="flex min-w-0 items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
        <TriangleAlert class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span class="min-w-0 break-words">
          <span class="text-muted-foreground">{{ t(`kcs.source.${hint.source}`) }} · </span>{{ message(hint) }}
        </span>
      </li>
    </ul>
    <p class="mt-1.5 text-[11px] text-muted-foreground">{{ t('kcs.creators.trendHintsNote') }}</p>
  </div>
</template>

<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next'
import type { TrendHint, TrendLocale } from '@kcs/contract'

defineProps<{ hints: TrendHint[] }>()

const { t, locale } = useI18n()

function message(hint: TrendHint): string {
  return hint.messages[locale.value as TrendLocale] ?? hint.messages['zh-CN']
}
</script>
