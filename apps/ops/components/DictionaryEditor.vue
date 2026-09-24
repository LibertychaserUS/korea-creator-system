<template>
  <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="dictionary-editor">
    <div class="flex flex-wrap items-center gap-3 border-b border-border/60 px-5 py-3.5">
      <BookText class="size-4 text-primary" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-semibold">{{ t('kcs.console.dictionary.title') }}</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">{{ t('kcs.console.dictionary.lead') }}</p>
      </div>
    </div>
    <div class="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div class="grid content-start gap-4">
        <div class="flex flex-wrap gap-3">
          <div class="grid gap-1.5">
            <Label for="dict-source" class="text-xs text-muted-foreground">{{ t('kcs.console.dictionary.source') }}</Label>
            <div class="relative">
              <select
                id="dict-source"
                v-model="source"
                data-testid="dictionary-source"
                class="border-input h-9 w-44 appearance-none rounded-md border bg-transparent pl-3 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option v-for="s in SOURCE_IDS" :key="s" :value="s">{{ t(`kcs.source.${s}`) }}</option>
              </select>
              <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
          <div class="grid gap-1.5">
            <span id="dict-kind-label" class="text-xs text-muted-foreground">{{ t('kcs.console.dictionary.kind') }}</span>
            <div class="inline-flex h-9 rounded-md border border-border bg-muted/40 p-0.5" role="group" aria-labelledby="dict-kind-label">
              <button
                v-for="k in DICTIONARY_KINDS"
                :key="k"
                type="button"
                class="rounded-[6px] px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                :class="kind === k ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
                :aria-pressed="kind === k"
                :data-testid="`dictionary-kind-${k}`"
                @click="kind = k"
              >
                {{ t(`kcs.console.dictionary.kinds.${k}`) }}
              </button>
            </div>
          </div>
        </div>

        <dl class="grid grid-cols-2 gap-3 text-xs">
          <div class="rounded-lg border border-border/60 px-3 py-2.5">
            <dt class="text-muted-foreground">{{ t('kcs.console.dictionary.platform') }}</dt>
            <dd class="mt-1 text-lg font-semibold tabular-nums" data-testid="dictionary-platform-count">{{ formatNumber(platform.length) }}</dd>
          </div>
          <div class="rounded-lg border border-border/60 px-3 py-2.5">
            <dt class="text-muted-foreground">{{ t('kcs.console.dictionary.seenLabel') }}</dt>
            <dd class="mt-1 text-lg font-semibold tabular-nums">{{ formatNumber(seen.length) }}</dd>
          </div>
        </dl>
        <p class="text-xs text-muted-foreground" data-testid="dictionary-updated">
          {{ updatedAt ? t('kcs.console.dictionary.updated', { time: formatDateTime(updatedAt) }) : t('kcs.console.dictionary.never') }}
        </p>
        <ul v-if="preview.length" class="flex flex-wrap gap-1.5" :aria-label="t('kcs.console.dictionary.platform')">
          <li
            v-for="o in preview"
            :key="o.value"
            class="rounded-md border px-2 py-0.5 text-xs"
            :class="o.origin === 'platform' ? 'border-border bg-background' : 'border-dashed border-amber-500/40 text-amber-800 dark:text-amber-200'"
            :title="o.origin === 'seen' ? t('kcs.console.dictionary.seenWarn') : undefined"
          >
            <span v-if="o.group" class="text-muted-foreground">{{ o.group }} › </span>{{ o.value }}
            <span v-if="o.creators" class="ml-1 tabular-nums text-muted-foreground">{{ formatNumber(o.creators) }}</span>
          </li>
          <li v-if="options.length > preview.length" class="px-1 text-xs text-muted-foreground">+{{ formatNumber(options.length - preview.length) }}</li>
        </ul>
      </div>

      <form v-if="canEdit" class="grid content-start gap-2" data-testid="dictionary-form" @submit.prevent="save">
        <Label for="dict-paste" class="text-xs text-muted-foreground">{{ t('kcs.console.dictionary.paste') }}</Label>
        <Textarea
          id="dict-paste"
          v-model="text"
          rows="9"
          class="max-h-72 font-mono text-xs"
          spellcheck="false"
          aria-describedby="dict-paste-hint"
          data-testid="dictionary-paste"
        />
        <p id="dict-paste-hint" class="text-[11px] leading-snug text-muted-foreground">{{ t('kcs.console.dictionary.pasteHint') }}</p>
        <div class="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" :disabled="saving" data-testid="btn-dictionary-save">
            <Loader2 v-if="saving" class="size-4 animate-spin" aria-hidden="true" />
            {{ saving ? t('kcs.console.dictionary.saving') : t('kcs.console.dictionary.save') }}
          </Button>
          <span class="text-xs tabular-nums text-muted-foreground">{{ t('kcs.console.dictionary.platformCount', { n: formatNumber(parsed.length) }) }}</span>
        </div>
      </form>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import { BookText, ChevronDown, Loader2 } from 'lucide-vue-next'
import {
  API,
  apiPath,
  DICTIONARY_KINDS,
  SOURCE_IDS,
  type DictionaryKind,
  type SourceDictionaries,
  type SourceId,
} from '@kcs/contract'

defineProps<{ canEdit: boolean }>()

const PREVIEW = 40

const { t } = useI18n()
const { request } = useApi()
const { formatNumber, formatDateTime } = useFormat()

const source = ref<SourceId>(SOURCE_IDS[0])
const kind = ref<DictionaryKind>('category')
const data = ref<SourceDictionaries | null>(null)
const text = ref('')
const saving = ref(false)

const options = computed(() => data.value?.[kind.value] ?? [])
const platform = computed(() => options.value.filter((o) => o.origin === 'platform'))
const seen = computed(() => options.value.filter((o) => o.origin === 'seen'))
const preview = computed(() => options.value.slice(0, PREVIEW))
const updatedAt = computed(() => data.value?.updatedAt[kind.value] ?? null)

/** 「上级 > 值」：最后一段是发给平台的值，前面是分组。 */
const parsed = computed(() =>
  text.value
    .split(/\r?\n/)
    .map((line) => line.split(/\s*[>＞]\s*/).map((part) => part.trim()).filter(Boolean))
    .filter((parts) => parts.length)
    .map((parts) => ({ value: parts[parts.length - 1]!, group: parts.length > 1 ? parts.slice(0, -1).join(' ') : null })),
)

function fillText() {
  text.value = platform.value.map((o) => (o.group ? `${o.group} > ${o.value}` : o.value)).join('\n')
}

async function load() {
  data.value = await request<SourceDictionaries>(apiPath(API.opsDictionaries, {}, { source: source.value })).catch(() => null)
  fillText()
}

async function save() {
  saving.value = true
  try {
    const res = await request<{ count: number }>(apiPath(API.opsDictionaryReplace, { source: source.value, kind: kind.value }), {
      method: 'POST',
      body: JSON.stringify({ items: parsed.value }),
    })
    toast.success(t('kcs.console.dictionary.saved', { n: formatNumber(res.count) }))
    await load()
  } catch {
    toast.error(t('kcs.console.dictionary.failed'))
  } finally {
    saving.value = false
  }
}

watch(source, load)
watch(kind, fillText)
onMounted(load)
</script>
