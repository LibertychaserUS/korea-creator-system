<template>
  <details class="group rounded-md border border-border/60 bg-background/60" data-testid="query-revisions" @toggle="onToggle">
    <summary class="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
      <History class="size-3.5" aria-hidden="true" />
      {{ t('kcs.query.revisions') }}
      <ChevronDown class="ml-auto size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
    </summary>
    <ol class="max-h-64 space-y-1 overflow-y-auto border-t border-border/60 px-3 py-2">
      <li v-if="loading" class="py-1"><Skeleton class="h-4 w-full" /></li>
      <li v-else-if="!items.length" class="py-1 text-xs text-muted-foreground">{{ t('kcs.query.noRevisions') }}</li>
      <li
        v-for="r in items"
        v-else
        :key="r.version"
        class="flex items-start gap-2 py-1 text-xs"
        :data-testid="`query-revision-${r.version}`"
      >
        <span class="min-w-0 flex-1 leading-relaxed">
          <span class="text-foreground">{{ r.name }}</span>
          <span class="block text-[11px] text-muted-foreground">
            {{ t('kcs.query.revisionLine', { n: r.version, action: t(`kcs.query.revisionAction.${r.action}`), who: r.editedByName || t('kcs.query.someone'), when: when(r.editedAt) }) }}
          </span>
        </span>
        <Button
          v-if="r.version !== currentVersion && r.action !== 'archive'"
          variant="ghost"
          size="sm"
          class="h-6 shrink-0 px-2 text-[11px]"
          :data-testid="`query-revision-use-${r.version}`"
          @click="emit('use', r)"
        >
          {{ t('kcs.query.useRevision') }}
        </Button>
      </li>
    </ol>
  </details>
</template>

<script setup lang="ts">
import { ChevronDown, History } from 'lucide-vue-next'
import { API, apiPath, type SavedQueryRevision } from '@kcs/contract'

/** 方案的修改记录：每一版是谁、什么时候、做了什么；可以把旧版放回编辑器再保存。 */
const props = defineProps<{ queryId: string; currentVersion: number }>()
const emit = defineEmits<{ use: [revision: SavedQueryRevision] }>()

const { t, locale } = useI18n()
const { request } = useApi()
const items = ref<SavedQueryRevision[]>([])
const loading = ref(false)
const open = ref(false)

function when(iso: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

async function load() {
  if (!props.queryId) return
  loading.value = true
  try {
    items.value = (await request<{ items: SavedQueryRevision[] }>(apiPath(API.queryRevisions, { id: props.queryId }))).items ?? []
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

function onToggle(event: Event) {
  open.value = (event.target as HTMLDetailsElement).open
  if (open.value) load()
}

watch(() => [props.queryId, props.currentVersion], () => {
  if (open.value) load()
})
</script>
