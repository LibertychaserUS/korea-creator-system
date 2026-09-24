<template>
  <PanelPage
    :testid="SCREEN_TESTID['A-batch-list']"
    :title="t('kcs.console.batches.title')"
    :eyebrow="t('kcs.nav.ops')"
    :lead="t('kcs.console.batches.lead')"
  >
    <Card v-if="canWrite" class="gap-0 border-border/60 py-0 shadow-xs" :data-testid="SCREEN_TESTID['A-batch-upload']">
      <div class="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
        <FileSpreadsheet class="size-4 text-primary" aria-hidden="true" />
        <h2 class="text-sm font-semibold">{{ t('kcs.console.batches.uploadTitle') }}</h2>
      </div>
      <form class="grid gap-4 px-5 py-5" data-testid="form-batch-upload" @submit.prevent="upload">
        <input
          ref="fileInput"
          type="file"
          class="sr-only"
          tabindex="-1"
          aria-hidden="true"
          :accept="XLSX_ACCEPT"
          data-testid="batch-file"
          @change="onChoose"
        >
        <button
          v-if="!file"
          type="button"
          class="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          :class="dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/40'"
          aria-describedby="batch-file-limit"
          data-testid="batch-drop"
          @click="fileInput?.click()"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <FileUp class="size-7 text-muted-foreground" aria-hidden="true" />
          <span class="text-sm font-medium text-foreground">{{ t('kcs.console.batches.drop') }}</span>
          <span id="batch-file-limit" class="text-xs text-muted-foreground">{{ t('kcs.console.batches.fileLimit', { size: formatBytes(WORKBOOK_MAX_BYTES) }) }}</span>
        </button>
        <div v-else class="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5" data-testid="batch-chosen">
          <FileSpreadsheet class="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-sm font-medium" :title="file.name">{{ file.name }}</span>
          <span class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ formatBytes(file.size) }}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="size-8 shrink-0"
            :disabled="uploading"
            :aria-label="t('kcs.console.batches.clearFile')"
            :title="t('kcs.console.batches.clearFile')"
            @click="clearFile"
          >
            <X class="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div class="grid gap-1.5 sm:max-w-md">
          <Label for="batch-name" class="text-xs text-muted-foreground">{{ t('kcs.console.batches.batchName') }}</Label>
          <Input
            id="batch-name"
            v-model="batchName"
            class="h-9"
            maxlength="120"
            :placeholder="t('kcs.console.batches.batchNamePlaceholder')"
            aria-describedby="batch-name-hint"
            data-testid="batch-name"
          />
          <p id="batch-name-hint" class="text-[11px] text-muted-foreground">{{ t('kcs.console.batches.batchNameHint') }}</p>
        </div>

        <div class="grid gap-2">
          <p class="text-xs text-muted-foreground">
            <span class="font-medium text-foreground">{{ t('kcs.console.batches.columns') }}</span>
            · {{ t('kcs.console.batches.columnsHint') }}
          </p>
          <ul class="flex flex-wrap gap-1.5" data-testid="batch-columns">
            <li
              v-for="c in COLUMNS"
              :key="c.key"
              class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
              :class="c.identity ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-border text-muted-foreground'"
            >
              {{ t(`kcs.console.batches.columnNames.${c.key}`) }}
              <span v-if="c.identity" class="text-[10px] text-primary">· {{ t('kcs.console.batches.oneOf') }}</span>
            </li>
          </ul>
        </div>

        <p v-if="error" role="alert" class="text-sm text-destructive" data-testid="batch-error">{{ error }}</p>
        <p v-if="result" role="status" class="text-sm text-foreground" data-testid="batch-result" :data-job-id="result.id">
          {{ t('kcs.console.batches.done', { written: formatNumber(result.writtenCount ?? 0), skipped: formatNumber(result.skippedDupes ?? 0), failed: formatNumber(result.failedCount ?? 0) }) }}
        </p>
        <div>
          <Button type="submit" :disabled="!file || uploading" data-testid="btn-batch-upload">
            <Loader2 v-if="uploading" class="size-4 animate-spin" aria-hidden="true" />
            <Upload v-else class="size-4" aria-hidden="true" />
            {{ uploading ? t('kcs.console.batches.uploading') : t('kcs.console.batches.submit') }}
          </Button>
        </div>
      </form>
    </Card>
    <p v-else class="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{{ t('kcs.console.batches.readOnly') }}</p>

    <TableCard :title="t('kcs.console.batches.listTitle')" testid="table-batches">
      <template #meta>
        <span class="tabular-nums">{{ t('kcs.console.batches.count', { n: formatNumber(total) }) }}</span>
      </template>
      <Table class="hidden md:table">
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead>{{ t('kcs.console.batches.cols.name') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.console.batches.cols.rows') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.console.batches.cols.written') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.console.batches.cols.skipped') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.console.batches.cols.failed') }}</TableHead>
            <TableHead class="w-28">{{ t('kcs.console.batches.cols.status') }}</TableHead>
            <TableHead class="w-36">{{ t('kcs.console.batches.cols.time') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading && !items.length">
            <TableRow v-for="i in 4" :key="`sk-${i}`" class="hover:bg-transparent">
              <TableCell v-for="j in 7" :key="j"><Skeleton class="h-4 w-16" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-for="job in items" :key="job.id" data-testid="row-batch" :data-job-id="job.id" :data-status="job.status">
            <TableCell class="max-w-72">
              <span class="block truncate font-medium text-foreground" :title="job.batchName || job.fileName">{{ job.batchName || job.fileName || '—' }}</span>
              <span v-if="job.fileName && job.fileName !== job.batchName" class="block truncate text-[11px] text-muted-foreground" :title="job.fileName">{{ job.fileName }}</span>
            </TableCell>
            <TableCell class="text-right tabular-nums">{{ formatNumber(job.sourceRows) }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ formatNumber(job.writtenCount) }}</TableCell>
            <TableCell class="text-right tabular-nums text-muted-foreground">{{ formatNumber(job.skippedDupes) }}</TableCell>
            <TableCell class="text-right tabular-nums" :class="job.failedCount ? 'text-destructive' : 'text-muted-foreground'">{{ formatNumber(job.failedCount) }}</TableCell>
            <TableCell><StatusBadge :status="job.status" /></TableCell>
            <TableCell class="text-xs tabular-nums text-muted-foreground">{{ formatDateTime(job.createdAt) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <ul class="divide-y divide-border/60 md:hidden">
        <li v-for="job in items" :key="job.id" class="space-y-1 px-4 py-3" :data-job-id="job.id">
          <div class="flex items-center justify-between gap-3">
            <span class="min-w-0 truncate text-sm font-medium text-foreground">{{ job.batchName || job.fileName || '—' }}</span>
            <StatusBadge :status="job.status" />
          </div>
          <p class="text-xs tabular-nums text-muted-foreground">
            {{ t('kcs.console.batches.cols.written') }} {{ formatNumber(job.writtenCount) }}
            · {{ t('kcs.console.batches.cols.skipped') }} {{ formatNumber(job.skippedDupes) }}
            · {{ t('kcs.console.batches.cols.failed') }} {{ formatNumber(job.failedCount) }}
          </p>
          <p class="text-[11px] tabular-nums text-muted-foreground">{{ formatDateTime(job.createdAt) }}</p>
        </li>
      </ul>
      <EmptyState v-if="!loading && !items.length" :title="t('kcs.console.batches.empty')" :icon="FileSpreadsheet" />
      <template v-if="pages > 1" #footer>
        <ListPager
          v-model:page="page"
          :pages="pages"
          :info="t('kcs.console.batches.pageInfo', { page, pages, total })"
          :prev-label="t('kcs.console.batches.prev')"
          :next-label="t('kcs.console.batches.next')"
          testid="batches-pager"
        />
      </template>
    </TableCard>
  </PanelPage>
</template>

<script setup lang="ts">
import { FileSpreadsheet, FileUp, Loader2, Upload, X } from 'lucide-vue-next'
import { API, apiPath, can, SCREEN_TESTID } from '@kcs/contract'

const PAGE_SIZE = 20
const WORKBOOK_MAX_BYTES = 20 * 1024 * 1024
const XLSX_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const COLUMNS: { key: string; identity?: boolean }[] = [
  { key: 'displayName', identity: true },
  { key: 'xhsId', identity: true },
  { key: 'userId', identity: true },
  { key: 'followers' },
  { key: 'price' },
  { key: 'region' },
  { key: 'vertical' },
  { key: 'keywords' },
  { key: 'persona' },
]

const { t } = useI18n()
const { request } = useApi()
const { user } = useSession()
const { formatNumber, formatBytes, formatDateTime } = useFormat()

const canWrite = computed(() => Boolean(user.value && can(user.value.role, 'ops.write')))
const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const batchName = ref('')
const dragging = ref(false)
const uploading = ref(false)
const error = ref('')
const result = ref<any>(null)
const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

function pick(chosen: File | undefined | null) {
  error.value = ''
  result.value = null
  if (!chosen) return
  if (!/\.xlsx$/i.test(chosen.name)) {
    error.value = t('kcs.console.batches.wrongType')
    return
  }
  if (chosen.size > WORKBOOK_MAX_BYTES) {
    error.value = t('kcs.console.batches.tooLarge', { size: formatBytes(WORKBOOK_MAX_BYTES) })
    return
  }
  file.value = chosen
}

function onChoose(ev: Event) {
  const input = ev.target as HTMLInputElement
  pick(input.files?.[0])
  input.value = ''
}

function onDrop(ev: DragEvent) {
  dragging.value = false
  pick(ev.dataTransfer?.files?.[0])
}

function clearFile() {
  file.value = null
  error.value = ''
}

async function upload() {
  if (!file.value) return
  uploading.value = true
  error.value = ''
  result.value = null
  try {
    const body = new FormData()
    body.append('file', file.value)
    if (batchName.value.trim()) body.append('batchName', batchName.value.trim())
    result.value = await request(API.opsBatchUpload.path, { method: 'POST', body })
    file.value = null
    batchName.value = ''
    if (page.value !== 1) page.value = 1
    else await load()
  } catch (e: any) {
    error.value = e?.status === 413
      ? t('kcs.console.batches.tooLarge', { size: formatBytes(WORKBOOK_MAX_BYTES) })
      : t('kcs.console.batches.failed')
  } finally {
    uploading.value = false
  }
}

async function load() {
  loading.value = true
  try {
    const res = await request<{ items: any[]; total: number }>(
      apiPath(API.ingestJobs, {}, { source: 'file-drop', page: page.value, pageSize: PAGE_SIZE }),
    )
    items.value = res.items ?? []
    total.value = res.total ?? 0
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

watch(page, load)
onMounted(load)
</script>
