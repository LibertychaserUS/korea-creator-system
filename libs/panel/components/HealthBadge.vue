<template>
  <span class="inline-flex flex-wrap items-center gap-1">
    <span
      class="inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium"
      :class="cls"
      :data-health="health ?? ''"
      :title="t('kcs.health.hint')"
    >
      <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {{ t(`kcs.health.${grade}`) }}
    </span>
    <span
      v-if="lowActive"
      class="inline-flex h-6 items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 text-[11px] font-medium text-amber-700 dark:text-amber-300"
      data-low-active="true"
      :title="t('kcs.health.lowActiveHint')"
    >
      {{ t('kcs.health.lowActive') }}
    </span>
  </span>
</template>

<script setup lang="ts">
import type { HealthGrade } from '@kcs/contract'

/**
 * 小红书健康等级两级：健康绿、异常红；是门不是分。旧记录的「优秀 / 正常」按健康显示。
 * 低活跃是另一项提示，单独一枚标签，不并进等级。
 */
const props = defineProps<{ health?: HealthGrade | null; lowActive?: boolean | null }>()
const { t } = useI18n()

const grade = computed(() => {
  // Frozen publish snapshots can still hold the old words.
  switch (props.health as string | null | undefined) {
    case 'healthy':
    case 'excellent':
    case 'normal':
      return 'healthy'
    case 'abnormal':
      return 'abnormal'
    default:
      return 'unknown'
  }
})

const cls = computed(() => {
  switch (grade.value) {
    case 'healthy':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'abnormal':
      return 'border-destructive/30 bg-destructive/10 text-destructive'
    default:
      return 'border-dashed border-border text-muted-foreground'
  }
})
</script>
