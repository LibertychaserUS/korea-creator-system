<template>
  <PanelPage testid="screen-a-creator-form" :title="t('kcs.panel.newCreator')" :eyebrow="t('kcs.nav.ops')">
    <div class="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{{ t('kcs.panel.createCreator') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <form class="grid gap-4" @submit.prevent="save">
            <div class="grid gap-2">
              <Label>{{ t('kcs.panel.displayName') }}</Label>
              <Input v-model="form.displayName" data-testid="creator-display-name" required />
            </div>
            <div class="grid gap-2">
              <Label>XHS</Label>
              <Input v-model="form.xhsId" />
            </div>
            <div class="grid gap-2">
              <Label>{{ t('kcs.panel.followers') }}</Label>
              <Input v-model.number="form.followers" data-testid="creator-followers" type="number" />
            </div>
            <div class="grid gap-2">
              <Label>{{ t('kcs.panel.quote') }}</Label>
              <Input v-model.number="form.priceMin" data-testid="creator-price-min" type="number" />
            </div>
            <div class="grid gap-2">
              <Label>{{ t('kcs.panel.avatar') }}</Label>
              <Input data-testid="creator-avatar" type="file" accept="image/*" @change="onFile" />
              <a
                v-if="avatarUrl"
                data-testid="creator-avatar-url"
                :href="avatarUrl"
                :src="avatarUrl"
                :data-object-key="avatarKey"
                class="text-sm text-primary underline"
              >{{ t('kcs.panel.avatar') }}</a>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                data-testid="category-collaborated"
                :aria-pressed="coopPressed(form.category, 'collaborated')"
                @click.prevent="form.category = selectCoop(form.category, 'collaborated')"
              >{{ t('kcs.panel.collaborated') }}</Button>
              <Button
                type="button"
                variant="outline"
                data-testid="category-never-collaborated"
                :aria-pressed="coopPressed(form.category, 'never_collaborated')"
                @click.prevent="form.category = selectCoop(form.category, 'never_collaborated')"
              >{{ t('kcs.panel.neverCollaborated') }}</Button>
            </div>
            <Button data-testid="btn-save-creator" type="submit">{{ t('kcs.panel.save') }}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{{ t('kcs.panel.publish') }}</CardTitle>
          <CardDescription>{{ t('kcs.panel.scoreLocked') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <p v-if="saved.creatorKey" data-testid="creator-key" :data-creator-key="saved.creatorKey" class="font-mono text-sm">
            {{ saved.creatorKey }}
          </p>
          <p v-if="saved.id" data-testid="creator-status" :data-status="saved.status">
            <Badge>{{ saved.status }}</Badge>
          </p>
          <Button v-if="saved.id" data-testid="btn-publish" type="button" @click="confirming = true">
            {{ t('kcs.panel.publish') }}
          </Button>
          <Button v-if="confirming" data-testid="btn-publish-confirm" type="button" @click="publish">
            {{ t('kcs.panel.confirmPublish') }}
          </Button>
        </CardContent>
      </Card>
    </div>
  </PanelPage>
</template>

<script setup lang="ts">
import { coopPressed, selectCoop, type CoopSlug } from '@/utils/coop-category'

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
