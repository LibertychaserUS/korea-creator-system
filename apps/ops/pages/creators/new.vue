<template>
  <PanelPage
    testid="screen-a-creator-form"
    :title="t('kcs.panel.newCreator')"
    :eyebrow="t('kcs.nav.ops')"
    :lead="t('kcs.panel.formHint')"
  >
    <template #actions>
      <Button as-child variant="outline" size="sm">
        <NuxtLink :to="localePath('/')">
          <ArrowLeft class="size-4" />
          {{ t('kcs.panel.opsHome') }}
        </NuxtLink>
      </Button>
    </template>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <!-- 表单 -->
      <Card class="gap-0 border-border/60 py-0 shadow-xs">
        <form class="divide-y divide-border" @submit.prevent="save">
          <section class="grid gap-5 p-5 sm:p-6">
            <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ t('kcs.panel.createCreator') }}</h2>

            <div class="grid gap-2">
              <Label for="creator-display-name" class="flex items-center justify-between">
                <span>{{ t('kcs.panel.displayName') }}</span>
                <span class="text-[11px] font-normal text-muted-foreground">{{ t('kcs.panel.required') }}</span>
              </Label>
              <Input
                id="creator-display-name"
                v-model="form.displayName"
                data-testid="creator-display-name"
                required
                autofocus
                maxlength="80"
                class="h-10 text-base"
                :disabled="Boolean(saved.id)"
              />
            </div>

            <div class="grid gap-5 sm:grid-cols-2">
              <div class="grid gap-2">
                <Label for="creator-xhs" class="flex items-center justify-between">
                  <span>{{ t('kcs.panel.xhsId') }}</span>
                  <span class="text-[11px] font-normal text-muted-foreground">{{ t('kcs.panel.optional') }}</span>
                </Label>
                <Input id="creator-xhs" v-model="form.xhsId" class="font-mono" :disabled="Boolean(saved.id)" />
              </div>
              <div class="grid gap-2">
                <Label for="creator-followers">{{ t('kcs.panel.followers') }}</Label>
                <div class="relative">
                  <Radio class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="creator-followers"
                    v-model.number="form.followers"
                    data-testid="creator-followers"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    class="pl-9 tabular-nums"
                    :disabled="Boolean(saved.id)"
                  />
                </div>
              </div>
            </div>

            <div class="grid gap-2">
              <Label for="creator-price-min">{{ t('kcs.panel.quote') }}</Label>
              <div class="flex items-center gap-2">
                <div class="relative flex-1">
                  <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">¥</span>
                  <Input
                    id="creator-price-min"
                    v-model.number="form.priceMin"
                    data-testid="creator-price-min"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    class="pl-8 tabular-nums"
                    :disabled="Boolean(saved.id)"
                  />
                </div>
                <span class="shrink-0 text-xs text-muted-foreground">CNY / {{ t('kcs.panel.quote') }}</span>
              </div>
            </div>
          </section>

          <section class="grid gap-5 p-5 sm:p-6">
            <div class="grid gap-2">
              <span class="text-sm font-medium">{{ t('kcs.panel.collabQuestion') }}</span>
              <div class="grid grid-cols-2 gap-2" role="group" :aria-label="t('kcs.panel.collabQuestion')">
                <button
                  type="button"
                  data-testid="category-collaborated"
                  class="coop-choice"
                  :aria-pressed="coopPressed(form.category, 'collaborated')"
                  :disabled="Boolean(saved.id)"
                  @click.prevent="form.category = selectCoop(form.category, 'collaborated')"
                >
                  <Handshake class="size-4" />
                  <span>{{ t('kcs.panel.collaborated') }}</span>
                  <Check class="coop-check size-4" />
                </button>
                <button
                  type="button"
                  data-testid="category-never-collaborated"
                  class="coop-choice"
                  :aria-pressed="coopPressed(form.category, 'never_collaborated')"
                  :disabled="Boolean(saved.id)"
                  @click.prevent="form.category = selectCoop(form.category, 'never_collaborated')"
                >
                  <Sparkles class="size-4" />
                  <span>{{ t('kcs.panel.neverCollaborated') }}</span>
                  <Check class="coop-check size-4" />
                </button>
              </div>
            </div>

            <div class="grid gap-2">
              <Label for="creator-avatar" class="flex items-center justify-between">
                <span>{{ t('kcs.panel.avatar') }}</span>
                <span class="text-[11px] font-normal text-muted-foreground">{{ t('kcs.panel.optional') }}</span>
              </Label>
              <div class="flex items-center gap-4">
                <Avatar class="size-14 border border-border">
                  <AvatarImage v-if="avatarUrl" :src="avatarUrl" :alt="form.displayName" />
                  <AvatarFallback class="bg-muted text-base text-muted-foreground">
                    {{ form.displayName.trim().charAt(0) || '?' }}
                  </AvatarFallback>
                </Avatar>
                <div class="min-w-0 flex-1 space-y-1.5">
                  <input
                    id="creator-avatar"
                    data-testid="creator-avatar"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    class="sr-only"
                    :disabled="uploading || Boolean(saved.id)"
                    @change="onFile"
                  />
                  <div class="flex flex-wrap items-center gap-2">
                    <label
                      for="creator-avatar"
                      class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-50"
                      :aria-disabled="uploading || Boolean(saved.id)"
                    >
                      <Upload class="size-3.5" />
                      {{ t('kcs.panel.chooseImage') }}
                    </label>
                    <span v-if="!avatarUrl && !uploading" class="text-xs text-muted-foreground">{{ t('kcs.panel.imageHint') }}</span>
                  </div>
                  <p v-if="uploadError" data-testid="creator-avatar-error" role="alert" class="text-xs text-destructive">
                    {{ t(uploadError) }}
                  </p>
                  <p v-if="uploading" class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 class="size-3.5 animate-spin" />
                    {{ t('kcs.panel.loading') }}
                  </p>
                  <a
                    v-else-if="avatarUrl"
                    data-testid="creator-avatar-url"
                    :href="avatarUrl"
                    :src="avatarUrl"
                    :data-object-key="avatarKey"
                    target="_blank"
                    rel="noreferrer"
                    class="inline-flex items-center gap-1 truncate font-mono text-[11px] text-primary underline-offset-4 hover:underline"
                  >
                    <ImageIcon class="size-3.5" />
                    {{ avatarKey }}
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section class="flex flex-wrap items-center gap-3 p-5 sm:p-6">
            <Button data-testid="btn-save-creator" type="submit" :disabled="!form.displayName.trim() || saving || Boolean(saved.id)">
              <Loader2 v-if="saving" class="size-4 animate-spin" />
              <Save v-else class="size-4" />
              {{ t('kcs.panel.save') }}
            </Button>
            <Button v-if="saved.id" type="button" variant="ghost" @click="reset">
              <RotateCcw class="size-4" />
              {{ t('kcs.panel.createCreator') }}
            </Button>
            <p v-if="error" class="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle class="size-4" />
              {{ t('kcs.panel.error') }}
            </p>
          </section>
        </form>
      </Card>

      <!-- 右侧：预览 + 发布 -->
      <aside class="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card class="gap-0 overflow-hidden border-border/60 py-0 shadow-xs">
          <div class="tide-preview-bar h-1.5" aria-hidden="true" />
          <div class="flex items-start gap-3 p-4">
            <Avatar class="size-12 border border-border">
              <AvatarImage v-if="avatarUrl" :src="avatarUrl" :alt="form.displayName" />
              <AvatarFallback class="bg-muted text-muted-foreground">{{ form.displayName.trim().charAt(0) || '?' }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-foreground">{{ form.displayName.trim() || t('kcs.panel.untitled') }}</p>
              <p class="truncate font-mono text-[11px] text-muted-foreground">
                <span v-if="saved.creatorKey" data-testid="creator-key" :data-creator-key="saved.creatorKey">{{ saved.creatorKey }}</span>
                <span v-else>{{ form.xhsId || '—' }}</span>
              </p>
            </div>
            <span v-if="saved.id" data-testid="creator-status" :data-status="saved.status">
              <StatusBadge :status="saved.status" kind="creator" />
            </span>
          </div>
          <dl class="grid grid-cols-2 gap-px border-t border-border/60 bg-border/60 text-sm">
            <div class="bg-card p-3">
              <dt class="text-[11px] text-muted-foreground">{{ t('kcs.panel.followers') }}</dt>
              <dd class="mt-0.5 font-semibold tabular-nums text-foreground">{{ formatNumber(form.followers) }}</dd>
            </div>
            <div class="bg-card p-3">
              <dt class="text-[11px] text-muted-foreground">{{ t('kcs.panel.quote') }}</dt>
              <dd class="mt-0.5 font-semibold tabular-nums text-foreground">{{ formatPrice(form.priceMin, 'CNY') }}</dd>
            </div>
          </dl>
          <div class="flex flex-wrap gap-1.5 border-t border-border/60 p-3">
            <Badge v-if="form.category === 'collaborated'" variant="outline" class="gap-1"><Handshake class="size-3" />{{ t('kcs.panel.collaborated') }}</Badge>
            <Badge v-else-if="form.category === 'never_collaborated'" variant="outline" class="gap-1"><Sparkles class="size-3" />{{ t('kcs.panel.neverCollaborated') }}</Badge>
            <span v-else class="text-xs text-muted-foreground">{{ t('kcs.panel.collabQuestion') }}</span>
          </div>
        </Card>

        <Card class="gap-0 border-border/60 py-0 shadow-xs">
          <div class="border-b border-border/60 px-4 py-3.5">
            <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ t('kcs.panel.publish') }}</h2>
            <p class="mt-0.5 text-xs text-muted-foreground">{{ t('kcs.panel.publishHint') }}</p>
          </div>
          <ol class="space-y-3 p-4">
            <li class="flex items-start gap-3">
              <span class="step-dot" :data-done="Boolean(saved.id)"><Check v-if="saved.id" class="size-3" /><span v-else>1</span></span>
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground">{{ t('kcs.panel.stepSave') }}</p>
                <p class="text-xs text-muted-foreground">{{ saved.id ? saved.creatorKey : t('kcs.panel.stepSaveHint') }}</p>
              </div>
            </li>
            <li class="flex items-start gap-3">
              <span class="step-dot" :data-done="saved.status === 'released'" :data-active="Boolean(saved.id) && saved.status !== 'released'">
                <Check v-if="saved.status === 'released'" class="size-3" /><span v-else>2</span>
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-foreground">{{ t('kcs.panel.stepPublish') }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ saved.status === 'released' ? t('kcs.panel.published') : t('kcs.panel.scoreLocked') }}
                </p>
                <div v-if="saved.id && saved.status !== 'released'" class="mt-2 flex flex-wrap gap-2">
                  <Button data-testid="btn-publish" type="button" size="sm" :disabled="confirming" @click="confirming = true">
                    <Send class="size-4" />
                    {{ t('kcs.panel.publish') }}
                  </Button>
                  <Button
                    v-if="confirming"
                    data-testid="btn-publish-confirm"
                    type="button"
                    size="sm"
                    variant="secondary"
                    :disabled="publishing"
                    @click="publish"
                  >
                    <Loader2 v-if="publishing" class="size-4 animate-spin" />
                    <Check v-else class="size-4" />
                    {{ t('kcs.panel.confirmPublish') }}
                  </Button>
                </div>
                <Button v-else-if="saved.status === 'released'" as-child size="sm" variant="outline" class="mt-2">
                  <a :href="`${config.public.selectUrl}/${locale}/`">
                    <ExternalLink class="size-4" />
                    {{ t('kcs.panel.openSelect') }}
                  </a>
                </Button>
              </div>
            </li>
          </ol>
        </Card>
      </aside>
    </div>
  </PanelPage>
</template>

<script setup lang="ts">
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ExternalLink,
  Handshake,
  Image as ImageIcon,
  Loader2,
  Radio,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Upload,
} from 'lucide-vue-next'
import { coopPressed, selectCoop, type CoopSlug } from '@libs/panel/utils/coop-category'

const { t, locale } = useI18n()
const { request } = useApi()
const localePath = useLocalePath()
const config = useRuntimeConfig()
const { formatNumber } = useFormat()
const { formatPrice } = useCurrency()

const form = reactive({
  displayName: '',
  xhsId: '',
  followers: 10000,
  category: '' as CoopSlug | '',
  priceMin: 3000,
})
const avatarUrl = ref('')
const avatarKey = ref('')
const uploading = ref(false)
const uploadError = ref('')
const AVATAR_MAX_BYTES = 5 * 1024 * 1024
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const saving = ref(false)
const publishing = ref(false)
const error = ref(false)
const confirming = ref(false)
const saved = reactive({ id: '', creatorKey: '', status: 'draft' })

async function onFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadError.value = ''
  if (file.type && !AVATAR_TYPES.includes(file.type)) {
    uploadError.value = 'kcs.panel.uploadWrongType'
    input.value = ''
    return
  }
  if (file.size > AVATAR_MAX_BYTES) {
    uploadError.value = 'kcs.panel.uploadTooLarge'
    input.value = ''
    return
  }
  uploading.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    body.append('purpose', 'avatar')
    const token = useCookie<string | null>('kcs_session')
    const res = await fetch(`${config.public.apiBase}/api/assets`, {
      method: 'POST',
      credentials: 'include',
      headers: token.value ? { authorization: `Bearer ${token.value}` } : {},
      body,
    })
    if (!res.ok) {
      uploadError.value = res.status === 413
        ? 'kcs.panel.uploadTooLarge'
        : res.status === 415
          ? 'kcs.panel.uploadWrongType'
          : 'kcs.panel.uploadFailed'
      return
    }
    const data = await res.json()
    avatarUrl.value = data.url
    avatarKey.value = data.key
  } catch {
    uploadError.value = 'kcs.panel.uploadFailed'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function save() {
  if (!form.displayName.trim()) return
  saving.value = true
  error.value = false
  try {
    const created = await request<any>('/api/ops/creators', {
      method: 'POST',
      body: JSON.stringify({
        displayName: form.displayName.trim(),
        xhsId: form.xhsId.trim() || undefined,
        regions: ['서울'],
        followers: form.followers,
        categories: form.category ? [form.category] : [],
        price: { amountMin: form.priceMin, currency: 'CNY' },
        avatarKey: avatarKey.value || undefined,
      }),
    })
    saved.id = created.id
    saved.creatorKey = created.creatorKey
    saved.status = 'draft'
  } catch {
    error.value = true
  } finally {
    saving.value = false
  }
}

async function publish() {
  publishing.value = true
  try {
    await request(`/api/ops/creators/${saved.id}/publish`, { method: 'POST' })
    saved.status = 'released'
    confirming.value = false
  } finally {
    publishing.value = false
  }
}

function reset() {
  form.displayName = ''
  form.xhsId = ''
  form.followers = 10000
  form.category = ''
  form.priceMin = 3000
  avatarUrl.value = ''
  avatarKey.value = ''
  uploadError.value = ''
  saved.id = ''
  saved.creatorKey = ''
  saved.status = 'draft'
  confirming.value = false
  error.value = false
}
</script>

<style scoped>
/* 合作记录二选一：选中态用主色描边 + 右侧对勾（不走 @apply，避免 SFC 里 @reference 的路径问题） */
.coop-choice {
  display: flex;
  height: 2.75rem;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--input);
  background: var(--background);
  padding: 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--muted-foreground);
  transition: border-color 150ms, color 150ms, background-color 150ms;
}
.coop-choice:hover:not(:disabled) {
  border-color: color-mix(in oklab, var(--primary) 40%, transparent);
  color: var(--foreground);
}
.coop-choice[aria-pressed='true'] {
  border-color: var(--primary);
  background: color-mix(in oklab, var(--primary) 6%, transparent);
  color: var(--foreground);
}
.coop-choice:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
.coop-check {
  margin-left: auto;
  color: var(--primary);
  opacity: 0;
  transition: opacity 150ms;
}
.coop-choice[aria-pressed='true'] .coop-check {
  opacity: 1;
}

.step-dot {
  display: flex;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: var(--background);
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-foreground);
}
.step-dot[data-active='true'] {
  border-color: var(--primary);
  color: var(--primary);
}
.step-dot[data-done='true'] {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--primary-foreground);
}

.tide-preview-bar {
  background: linear-gradient(90deg, oklch(0.45 0.085 235), oklch(0.62 0.08 200) 55%, oklch(0.88 0.07 75));
}
</style>
