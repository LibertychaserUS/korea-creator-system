<template>
  <span
    class="inline-flex size-7 items-center justify-center rounded-md border font-mono text-xs font-semibold tabular-nums"
    :class="cls"
    :data-grade="grade ?? ''"
    :title="grade ? `${grade}` : undefined"
  >
    {{ grade ?? '—' }}
  </span>
</template>

<script setup lang="ts">
/** 规则包等级 S/A/B/C：S 深海实心，A 海色，B 沙色，C 中性。 */
const props = defineProps<{ grade?: string | null }>()

const cls = computed(() => {
  switch (props.grade) {
    case 'S':
      return 'border-primary bg-primary text-primary-foreground'
    case 'A':
      return 'border-primary/30 bg-primary/10 text-primary'
    case 'B':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'C':
      return 'border-border bg-muted text-muted-foreground'
    default:
      return 'border-transparent text-muted-foreground'
  }
})
</script>
