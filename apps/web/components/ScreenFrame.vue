<template>
  <section :data-testid="testid" v-bind="extraAttrs">
    <h1>{{ title }}</h1>
    <p v-if="note" class="muted">{{ note }}</p>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
defineProps<{ testid: string; title: string; note?: string }>()
const attrs = useAttrs()
const extraAttrs = computed(() => {
  const { class: _c, ...rest } = attrs
  return rest
})
</script>
