<template>
  <span
    class="inline-flex h-6 items-center gap-1 rounded-md border border-border/60 bg-background px-2 text-[11px] font-medium text-muted-foreground"
    :data-source="source ?? ''"
  >
    <span class="size-1.5 rounded-full" :class="route === 'official' ? 'bg-primary' : 'bg-amber-500/80'" aria-hidden="true" />
    {{ label }}
    <span v-if="mode === 'fixture'" class="rounded-sm bg-amber-500/15 px-1 text-[10px] text-amber-700 dark:text-amber-300">
      {{ t('kcs.source.fixture') }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { SOURCE_ROUTE, type SourceId } from '@kcs/contract'

/** 数据源徽标：蒲公英(官方，主色点) / 千瓜、新红(合作平台，琥珀点)，演示数据加标。 */
const props = defineProps<{ source?: SourceId | string | null; mode?: 'fixture' | 'live' | string | null }>()
const { t, te } = useI18n()

const label = computed(() => (props.source && te(`kcs.source.${props.source}`) ? t(`kcs.source.${props.source}`) : props.source || '—'))
const route = computed(() => (props.source ? SOURCE_ROUTE[props.source as SourceId] : undefined))
</script>
