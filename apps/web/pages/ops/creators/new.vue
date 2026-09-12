<template>
  <ScreenFrame testid="screen-a-creator-form" :title="t('navCreatorNew')">
    <form class="ledger-form ledger-2" @submit.prevent="save">
      <div>
        <label class="field inline"><span>{{ t('createCreator') }}</span>
          <input v-model="form.displayName" data-testid="creator-display-name" required />
        </label>
        <label class="field inline"><span>XHS</span><input v-model="form.xhsId" /></label>
        <label class="field inline"><span>{{ t('home.draft') }}</span>
          <input v-model.number="form.followers" data-testid="creator-followers" type="number" />
        </label>
        <label class="field inline"><span>CNY</span>
          <input v-model.number="form.priceMin" data-testid="creator-price-min" type="number" />
        </label>
        <label class="field">
          avatar
          <input data-testid="creator-avatar" type="file" accept="image/*" @change="onFile" />
        </label>
        <a
          v-if="avatarUrl"
          data-testid="creator-avatar-url"
          :href="avatarUrl"
          :src="avatarUrl"
          :data-object-key="avatarKey"
        >avatar</a>
        <div class="filters">
          <button
            type="button"
            data-testid="category-collaborated"
            class="btn ghost"
            :aria-pressed="coopPressed(form.category, 'collaborated')"
            @click.prevent="form.category = selectCoop(form.category, 'collaborated')"
          >合作过的</button>
          <button
            type="button"
            data-testid="category-never-collaborated"
            class="btn ghost"
            :aria-pressed="coopPressed(form.category, 'never_collaborated')"
            @click.prevent="form.category = selectCoop(form.category, 'never_collaborated')"
          >没合作过的</button>
        </div>
        <button class="btn" data-testid="btn-save-creator" type="submit">{{ t('createCreator') }}</button>
      </div>
      <div>
        <p v-if="saved.creatorKey" data-testid="creator-key" :data-creator-key="saved.creatorKey">{{ saved.creatorKey }}</p>
        <p v-if="saved.id" data-testid="creator-status" :data-status="saved.status">{{ saved.status }}</p>
        <button v-if="saved.id" class="btn" data-testid="btn-publish" type="button" @click="confirming = true">{{ t('publish') }}</button>
        <button v-if="confirming" class="btn" data-testid="btn-publish-confirm" type="button" @click="publish">{{ t('publish') }}</button>
        <p class="muted">{{ t('score.locked') }}</p>
      </div>
    </form>
  </ScreenFrame>
</template>

<script setup lang="ts">
import { coopPressed, selectCoop, type CoopSlug } from '~/utils/coop-category'

const { t } = useI18n()
const { request } = useApi()
const form = reactive({
  displayName: '',
  xhsId: '',
  followers: 10000,
  category: '' as CoopSlug | '',
  priceMin: 3000,
})
const avatarUrl = ref('')
const avatarKey = ref('')
const confirming = ref(false)
const saved = reactive({ id: '', creatorKey: '', status: 'draft' })

async function onFile(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  const body = new FormData()
  body.append('file', file)
  body.append('purpose', 'avatar')
  const config = useRuntimeConfig()
  const token = useCookie<string | null>('kcs_session')
  const res = await fetch(`${config.public.apiBase}/api/assets`, {
    method: 'POST',
    credentials: 'include',
    headers: token.value ? { authorization: `Bearer ${token.value}` } : {},
    body,
  })
  const data = await res.json()
  avatarUrl.value = data.url
  avatarKey.value = data.key
}

async function save() {
  const created = await request<any>('/api/ops/creators', {
    method: 'POST',
    body: JSON.stringify({
      displayName: form.displayName,
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
}

async function publish() {
  await request(`/api/ops/creators/${saved.id}/publish`, { method: 'POST' })
  saved.status = 'released'
  confirming.value = false
}
</script>
