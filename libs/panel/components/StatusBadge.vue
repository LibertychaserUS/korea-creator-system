<template>
  <Badge :variant="tone.variant" :class="tone.class" :data-status="status">
    <span v-if="dot" class="size-1.5 rounded-full bg-current" aria-hidden="true" />
    {{ label }}
  </Badge>
</template>

<script setup lang="ts">
/**
 * 状态徽标：把 API 里的原始状态词（ok / running / failed / assigned …）
 * 翻成当前语言，并给出一致的色调。未知状态原样显示、灰底。
 */
const props = withDefaults(
  defineProps<{
    status: string
    kind?: 'job' | 'assignment' | 'creator' | 'stage'
    dot?: boolean
  }>(),
  { kind: 'job', dot: true },
)

const { t, te } = useI18n()

const key = computed(() => {
  if (props.kind === 'creator') return `kcs.panel.${props.status}`
  if (props.kind === 'stage') return `kcs.opsCreators.stage.${props.status}`
  return `kcs.panel.${props.kind === 'job' ? 'jobStatus' : 'assignmentStatus'}.${props.status}`
})
const label = computed(() => (te(key.value) ? t(key.value) : props.status))

const tone = computed<{ variant: 'default' | 'secondary' | 'destructive' | 'outline'; class: string }>(() => {
  switch (props.status) {
    case 'ok':
    case 'assigned':
    case 'released':
      return { variant: 'outline', class: 'border-(--success)/30 bg-(--success)/10 text-(--success)' }
    case 'running':
    case 'ready':
      return { variant: 'outline', class: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300' }
    case 'queued':
    case 'review':
      return { variant: 'outline', class: 'border-(--warning)/30 bg-(--warning)/10 text-(--warning)' }
    case 'partial':
      return { variant: 'outline', class: 'border-(--warning)/30 bg-(--warning)/10 text-(--warning)' }
    case 'degraded':
      return { variant: 'outline', class: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300' }
    case 'withdrawn':
      return { variant: 'outline', class: 'border-border bg-muted text-muted-foreground' }
    case 'failed':
    case 'removed':
      return { variant: 'outline', class: 'border-destructive/30 bg-destructive/10 text-destructive' }
    default:
      return { variant: 'secondary', class: '' }
  }
})
</script>
