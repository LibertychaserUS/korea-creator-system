<template>
  <div
    class="min-h-[calc(100svh-3.5rem)] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
    :data-testid="testid"
    v-bind="extraAttrs"
  >
    <div class="mx-auto flex max-w-7xl flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0 max-w-2xl">
          <p v-if="eyebrow" class="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
            <span class="h-px w-5 bg-primary/60" aria-hidden="true" />
            {{ eyebrow }}
          </p>
          <h1 class="text-2xl font-semibold tracking-tight text-foreground md:text-[28px] md:leading-9">{{ title }}</h1>
          <p v-if="lead" class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ lead }}</p>
        </div>
        <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
          <slot name="actions" />
        </div>
      </header>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
defineProps<{
  testid: string
  title: string
  eyebrow?: string
  lead?: string
}>()
const attrs = useAttrs()
const extraAttrs = computed(() => {
  const { class: _c, ...rest } = attrs
  return rest
})
</script>
