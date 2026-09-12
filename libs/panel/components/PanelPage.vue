<template>
  <div
    class="bg-background min-h-[calc(100svh-4rem)] p-8"
    :data-testid="testid"
    v-bind="extraAttrs"
  >
    <div class="mx-auto max-w-7xl space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p v-if="eyebrow" class="text-sm font-medium text-muted-foreground mb-1">{{ eyebrow }}</p>
          <h1 class="text-3xl font-bold text-foreground">{{ title }}</h1>
        </div>
        <slot name="actions" />
      </div>
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
}>()
const attrs = useAttrs()
const extraAttrs = computed(() => {
  const { class: _c, ...rest } = attrs
  return rest
})
</script>
