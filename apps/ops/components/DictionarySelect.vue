<template>
  <div class="grid gap-1">
    <div v-if="useList" class="relative">
      <select
        :id="id"
        :value="modelValue ?? ''"
        :disabled="disabled"
        :data-testid="testid"
        :aria-describedby="warn ? `${id}-warn` : undefined"
        class="border-input h-9 w-full appearance-none rounded-md border bg-transparent pl-3 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        @change="onPick(($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t('kcs.console.dictionary.any') }}</option>
        <option v-if="modelValue && !known" :value="modelValue">{{ modelValue }}</option>
        <template v-for="g in groups" :key="g.key">
          <optgroup v-if="g.label" :label="g.label">
            <option v-for="o in g.options" :key="o.value" :value="o.value">{{ o.value }}</option>
          </optgroup>
          <template v-else>
            <option v-for="o in g.options" :key="o.value" :value="o.value">{{ o.value }}</option>
          </template>
        </template>
        <option :value="CUSTOM">{{ t('kcs.console.dictionary.custom') }}</option>
      </select>
      <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
    <div v-else class="flex gap-1.5">
      <Input
        :id="id"
        ref="inputRef"
        :model-value="modelValue"
        class="h-9"
        :disabled="disabled"
        :data-testid="testid"
        :placeholder="options.length ? undefined : t('kcs.console.dictionary.none')"
        @update:model-value="(v: string | number) => emit('update:modelValue', String(v))"
      />
      <Button
        v-if="options.length"
        type="button"
        variant="ghost"
        size="icon"
        class="size-9 shrink-0"
        :disabled="disabled"
        :aria-label="t('kcs.console.dictionary.backToList')"
        :title="t('kcs.console.dictionary.backToList')"
        @click="typing = false"
      >
        <List class="size-4" aria-hidden="true" />
      </Button>
    </div>
    <p v-if="warn" :id="`${id}-warn`" class="text-[11px] leading-snug text-amber-700 dark:text-amber-300">
      {{ t('kcs.console.dictionary.seenWarn') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, List } from 'lucide-vue-next'
import type { DictionaryOption } from '@kcs/contract'

const props = defineProps<{
  id: string
  modelValue?: string
  options: DictionaryOption[]
  disabled?: boolean
  testid?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const CUSTOM = '\u0000custom'

const { t } = useI18n()
const typing = ref(false)
const inputRef = ref<{ $el?: HTMLElement } | null>(null)

const useList = computed(() => props.options.length > 0 && !typing.value)
const known = computed(() => props.options.some((o) => o.value === props.modelValue))
const warn = computed(() => props.options.find((o) => o.value === props.modelValue)?.origin === 'seen')

/** 平台字典按上级分组、保持平台顺序；库里出现过的单独一组放最后。 */
const groups = computed(() => {
  const out: { key: string; label: string | null; options: DictionaryOption[] }[] = []
  const byKey = new Map<string, (typeof out)[number]>()
  for (const o of props.options) {
    const key = o.origin === 'seen' ? '\u0000seen' : o.group ?? ''
    let g = byKey.get(key)
    if (!g) {
      g = { key, label: o.origin === 'seen' ? t('kcs.console.dictionary.seen') : o.group, options: [] }
      byKey.set(key, g)
      out.push(g)
    }
    g.options.push(o)
  }
  const seen = out.findIndex((g) => g.key === '\u0000seen')
  if (seen >= 0) out.push(...out.splice(seen, 1))
  return out
})

async function onPick(value: string) {
  if (value !== CUSTOM) {
    emit('update:modelValue', value)
    return
  }
  typing.value = true
  await nextTick()
  const el = inputRef.value?.$el
  ;(el instanceof HTMLInputElement ? el : el?.querySelector?.('input'))?.focus()
}

watch(
  () => props.options,
  () => {
    if (!props.options.length) typing.value = false
  },
)
</script>
