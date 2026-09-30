<template>
  <span
    class="inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium"
    :class="cls"
    :data-tier="tier ?? ''"
    :title="t('kcs.tier.hint')"
  >
    {{ t(`kcs.tier.${tier ?? 'unknown'}`) }}
  </span>
</template>

<script setup lang="ts">
import type { CreatorTier } from '@kcs/contract'

/** 粉丝量级（千瓜口径）：头部实心、腰部海色、初级沙色、素人中性。 */
const props = defineProps<{ tier?: CreatorTier | null }>()
const { t } = useI18n()

const cls = computed(() => {
  switch (props.tier) {
    case 'head':
      return 'border-primary bg-primary text-primary-foreground'
    case 'mid':
      return 'border-primary/30 bg-primary/10 text-primary'
    case 'junior':
      return 'border-(--warning)/30 bg-(--warning)/10 text-(--warning)'
    case 'amateur':
      return 'border-border bg-muted text-muted-foreground'
    default:
      return 'border-dashed border-border text-muted-foreground'
  }
})
</script>
