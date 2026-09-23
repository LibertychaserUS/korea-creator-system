<template>
  <nav class="flex items-center justify-between gap-3 text-xs text-muted-foreground" :data-testid="testid">
    <span class="tabular-nums">{{ info }}</span>
    <div class="flex gap-1.5">
      <Button variant="outline" size="sm" :disabled="page <= 1" :aria-label="prevLabel" @click="emit('update:page', page - 1)">
        <ChevronLeft class="size-4" />
        <span class="hidden sm:inline">{{ prevLabel }}</span>
      </Button>
      <Button variant="outline" size="sm" :disabled="page >= pages" :aria-label="nextLabel" @click="emit('update:page', page + 1)">
        <span class="hidden sm:inline">{{ nextLabel }}</span>
        <ChevronRight class="size-4" />
      </Button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

/** 前端分页条：「第 x / y 页 · 共 n 位」+ 上一页 / 下一页，文案由调用方给。 */
defineProps<{
  page: number
  pages: number
  info: string
  prevLabel: string
  nextLabel: string
  testid?: string
}>()
const emit = defineEmits<{ 'update:page': [value: number] }>()
</script>
