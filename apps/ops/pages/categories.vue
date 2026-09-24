<template>
  <PanelPage
    testid="screen-a-categories"
    :title="t('kcs.console.categories.title')"
    :eyebrow="t('kcs.nav.ops')"
    :lead="t('kcs.console.categories.lead')"
  >
    <template #actions>
      <Button v-if="canEdit && !creating" size="sm" data-testid="btn-category-new" @click="startCreate">
        <Plus class="size-4" aria-hidden="true" />
        {{ t('kcs.console.categories.create') }}
      </Button>
    </template>

    <p v-if="!canEdit" class="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground" data-testid="categories-readonly">
      {{ t('kcs.console.categories.readOnly') }}
    </p>

    <Card v-if="creating" class="gap-0 border-border/60 py-0 shadow-xs" data-testid="form-category-new">
      <form class="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-4" @submit.prevent="create">
        <h2 class="text-sm font-semibold md:col-span-2 xl:col-span-4">{{ t('kcs.console.categories.createTitle') }}</h2>
        <div class="grid gap-1.5">
          <Label for="cat-slug" class="text-xs text-muted-foreground">{{ t('kcs.console.categories.slug') }}</Label>
          <Input
            id="cat-slug"
            v-model="draft.slug"
            class="h-9 font-mono"
            autocomplete="off"
            spellcheck="false"
            aria-describedby="cat-slug-hint"
            :aria-invalid="Boolean(draft.slug) && !slugOk"
            data-testid="category-slug"
          />
          <p id="cat-slug-hint" class="text-[11px] leading-snug text-muted-foreground">{{ t('kcs.console.categories.slugHint') }}</p>
        </div>
        <div v-for="field in NAME_FIELDS" :key="field.key" class="grid content-start gap-1.5">
          <Label :for="`cat-${field.key}`" class="text-xs text-muted-foreground">{{ t(field.label) }}</Label>
          <Input :id="`cat-${field.key}`" v-model="draft.names[field.key]" class="h-9" :data-testid="`category-name-${field.key}`" />
        </div>
        <label class="flex items-center gap-2 text-sm md:col-span-2 xl:col-span-4">
          <Switch v-model="draft.frontendVisible" :aria-label="t('kcs.console.categories.visible')" data-testid="category-visible" />
          <span>{{ t('kcs.console.categories.visible') }}</span>
          <span class="text-xs text-muted-foreground">· {{ t('kcs.console.categories.visibleHint') }}</span>
        </label>
        <p v-if="formError" role="alert" class="text-sm text-destructive md:col-span-2 xl:col-span-4" data-testid="category-error">{{ formError }}</p>
        <div class="flex gap-2 md:col-span-2 xl:col-span-4">
          <Button type="submit" :disabled="busy" data-testid="btn-category-create">
            <Loader2 v-if="busy" class="size-4 animate-spin" aria-hidden="true" />
            {{ busy ? t('kcs.console.categories.saving') : t('kcs.console.categories.save') }}
          </Button>
          <Button type="button" variant="ghost" :disabled="busy" @click="creating = false">{{ t('kcs.console.categories.cancel') }}</Button>
        </div>
      </form>
    </Card>

    <TableCard :title="t('kcs.console.categories.listTitle')" :description="t('kcs.console.categories.listLead')" testid="table-categories">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead>{{ t('kcs.console.categories.cols.name') }}</TableHead>
            <TableHead class="hidden md:table-cell">{{ t('kcs.console.categories.cols.slug') }}</TableHead>
            <TableHead class="text-right">{{ t('kcs.console.categories.cols.creators') }}</TableHead>
            <TableHead class="w-24 text-center">{{ t('kcs.console.categories.cols.visible') }}</TableHead>
            <TableHead class="w-20 text-center">{{ t('kcs.console.categories.cols.enabled') }}</TableHead>
            <TableHead v-if="canEdit" class="w-14"><span class="sr-only">{{ t('kcs.console.categories.cols.actions') }}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading && !items.length">
            <TableRow v-for="i in 5" :key="`sk-${i}`" class="hover:bg-transparent">
              <TableCell v-for="j in (canEdit ? 6 : 5)" :key="j"><Skeleton class="h-4 w-20" /></TableCell>
            </TableRow>
          </template>
          <template v-for="c in items" :key="c.slug">
            <TableRow :data-category="c.slug" data-testid="row-category">
              <TableCell>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium text-foreground">{{ nameOf(c) }}</span>
                  <Badge v-if="c.builtin" variant="outline" class="text-[10px]">{{ t('kcs.console.categories.builtin') }}</Badge>
                </div>
                <p class="mt-0.5 text-[11px] text-muted-foreground">{{ otherNames(c) }}</p>
              </TableCell>
              <TableCell class="hidden font-mono text-xs text-muted-foreground md:table-cell">{{ c.slug }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ formatNumber(usage[c.slug] ?? 0) }}</TableCell>
              <TableCell class="text-center">
                <Switch
                  :model-value="c.frontendVisible"
                  :disabled="!canEdit || saving === c.slug"
                  :aria-label="t('kcs.console.categories.visibleLabel', { name: nameOf(c) })"
                  data-testid="category-toggle-visible"
                  @update:model-value="(v: boolean) => patch(c, { frontendVisible: v })"
                />
              </TableCell>
              <TableCell class="text-center">
                <Switch
                  :model-value="c.enabled"
                  :disabled="!canEdit || saving === c.slug || isCoop(c)"
                  :title="isCoop(c) ? t('kcs.console.categories.coopLocked') : undefined"
                  :aria-label="t('kcs.console.categories.enableLabel', { name: nameOf(c) })"
                  data-testid="category-toggle-enabled"
                  @update:model-value="(v: boolean) => patch(c, { enabled: v })"
                />
              </TableCell>
              <TableCell v-if="canEdit" class="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  :aria-label="t('kcs.console.categories.editLabel', { name: nameOf(c) })"
                  :title="t('kcs.console.categories.edit')"
                  :aria-expanded="editing === c.slug"
                  data-testid="btn-category-edit"
                  @click="toggleEdit(c)"
                >
                  <Pencil class="size-4" aria-hidden="true" />
                </Button>
              </TableCell>
            </TableRow>
            <TableRow v-if="editing === c.slug" class="bg-muted/30 hover:bg-muted/30">
              <TableCell :colspan="6">
                <form class="grid gap-3 sm:grid-cols-3" data-testid="form-category-edit" @submit.prevent="saveNames(c)">
                  <div v-for="field in NAME_FIELDS" :key="field.key" class="grid gap-1.5">
                    <Label :for="`edit-${c.slug}-${field.key}`" class="text-xs text-muted-foreground">{{ t(field.label) }}</Label>
                    <Input :id="`edit-${c.slug}-${field.key}`" v-model="names[field.key]" class="h-9" />
                  </div>
                  <div class="flex flex-wrap items-center gap-2 sm:col-span-3">
                    <Button type="submit" size="sm" :disabled="saving === c.slug" data-testid="btn-category-save">
                      {{ saving === c.slug ? t('kcs.console.categories.saving') : t('kcs.console.categories.save') }}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" @click="editing = null">{{ t('kcs.console.categories.cancel') }}</Button>
                    <p v-if="formError" role="alert" class="text-xs text-destructive">{{ formError }}</p>
                  </div>
                </form>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
      <EmptyState v-if="!loading && !items.length" :title="t('kcs.console.categories.empty')" :icon="Tags" />
      <template v-if="items.some(isCoop)" #footer>
        <p class="text-xs text-muted-foreground">{{ t('kcs.console.categories.coopLocked') }}</p>
      </template>
    </TableCard>

    <DictionaryEditor :can-edit="canEdit" />
  </PanelPage>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Loader2, Pencil, Plus, Tags } from 'lucide-vue-next'
import { API, apiPath, can, CATEGORY_SLUG, type CategoryUsage, type CategoryView } from '@kcs/contract'

type NameKey = 'zh-CN' | 'en' | 'ko'
const NAME_FIELDS: { key: NameKey; label: string }[] = [
  { key: 'zh-CN', label: 'kcs.console.categories.nameZh' },
  { key: 'en', label: 'kcs.console.categories.nameEn' },
  { key: 'ko', label: 'kcs.console.categories.nameKo' },
]
const COOP = ['collaborated', 'never_collaborated']

const { t, locale } = useI18n()
const { request } = useApi()
const { user } = useSession()
const { formatNumber } = useFormat()

const items = ref<CategoryView[]>([])
const usage = ref<Record<string, number>>({})
const loading = ref(true)
const saving = ref<string | null>(null)
const editing = ref<string | null>(null)
const names = reactive<Record<NameKey, string>>({ 'zh-CN': '', en: '', ko: '' })
const creating = ref(false)
const busy = ref(false)
const formError = ref('')
const draft = reactive({ slug: '', names: { 'zh-CN': '', en: '', ko: '' } as Record<NameKey, string>, frontendVisible: true })

const canEdit = computed(() => Boolean(user.value && can(user.value.role, 'ops.categories')))
const slugOk = computed(() => CATEGORY_SLUG.test(draft.slug))
const isCoop = (c: CategoryView) => COOP.includes(c.slug)

function nameOf(c: CategoryView) {
  if (locale.value === 'en') return c.nameEn || c.nameZh
  if (locale.value === 'ko') return c.nameKo || c.nameZh
  return c.nameZh
}

function otherNames(c: CategoryView) {
  const all = { 'zh-CN': c.nameZh, en: c.nameEn, ko: c.nameKo } as Record<string, string>
  return Object.entries(all).filter(([key]) => key !== locale.value).map(([, v]) => v).join(' · ')
}

async function load() {
  const [list, counts] = await Promise.all([
    request<{ items: CategoryView[] }>(API.opsCategories.path),
    request<CategoryUsage>(API.opsCategoryUsage.path).catch(() => ({ items: [] })),
  ])
  items.value = list.items ?? []
  usage.value = Object.fromEntries(counts.items.map((u) => [u.slug, u.creators]))
}

async function patch(c: CategoryView, body: Partial<Pick<CategoryView, 'enabled' | 'frontendVisible'>> | { names: Record<NameKey, string> }) {
  saving.value = c.slug
  formError.value = ''
  try {
    await request(apiPath(API.opsCategoryPatch, { slug: c.slug }), { method: 'PATCH', body: JSON.stringify(body) })
    await load()
    toast.success(t('kcs.console.categories.saved'))
    return true
  } catch {
    toast.error(t('kcs.console.categories.failed'))
    return false
  } finally {
    saving.value = null
  }
}

function toggleEdit(c: CategoryView) {
  formError.value = ''
  if (editing.value === c.slug) {
    editing.value = null
    return
  }
  editing.value = c.slug
  names['zh-CN'] = c.nameZh
  names.en = c.nameEn
  names.ko = c.nameKo
}

async function saveNames(c: CategoryView) {
  if (NAME_FIELDS.some((f) => !names[f.key].trim())) {
    formError.value = t('kcs.console.categories.namesRequired')
    return
  }
  const trimmed = Object.fromEntries(NAME_FIELDS.map((f) => [f.key, names[f.key].trim()])) as Record<NameKey, string>
  if (await patch(c, { names: trimmed })) editing.value = null
}

function startCreate() {
  draft.slug = ''
  draft.names = { 'zh-CN': '', en: '', ko: '' }
  draft.frontendVisible = true
  formError.value = ''
  creating.value = true
}

async function create() {
  formError.value = ''
  if (!slugOk.value) {
    formError.value = t('kcs.console.categories.invalid')
    return
  }
  if (NAME_FIELDS.some((f) => !draft.names[f.key].trim())) {
    formError.value = t('kcs.console.categories.namesRequired')
    return
  }
  busy.value = true
  try {
    const created = await request<CategoryView>(API.opsCategoryCreate.path, {
      method: 'POST',
      body: JSON.stringify({
        slug: draft.slug,
        names: Object.fromEntries(NAME_FIELDS.map((f) => [f.key, draft.names[f.key].trim()])),
        frontendVisible: draft.frontendVisible,
      }),
    })
    creating.value = false
    await load()
    toast.success(t('kcs.console.categories.created', { name: nameOf(created) }))
  } catch (e: any) {
    formError.value = e?.status === 409 ? t('kcs.console.categories.exists') : e?.status === 400 ? t('kcs.console.categories.invalid') : t('kcs.console.categories.failed')
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  try {
    await load()
  } finally {
    loading.value = false
  }
})
</script>
