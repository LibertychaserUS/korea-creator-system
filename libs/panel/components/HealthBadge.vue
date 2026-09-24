<template>
  <span
    class="inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium"
    :class="cls"
    :data-health="health ?? ''"
    :title="t('kcs.health.hint')"
  >
    <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />
    {{ t(`kcs.health.${health ?? 'unknown'}`) }}
  </span>
</template>

<script setup lang="ts">
import type { HealthGrade } from '@kcs/contract'

/** 小红书健康等级两级：健康绿、异常红；是门不是分。旧记录的「优秀 / 正常」按健康显示。 */
const props = defineProps<{ health?: HealthGrade | null }>()
const { t } = useI18n()

const cls = computed(() => {
  switch (props.health) {
    case 'healthy':
    case 'excellent':
    case 'normal':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'abnormal':
      return 'border-destructive/30 bg-destructive/10 text-destructive'
    default:
      return 'border-dashed border-border text-muted-foreground'
  }
})
</script>
