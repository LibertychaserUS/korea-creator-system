<template>
  <ScreenFrame testid="screen-c-creator" :title="item.displayName || t('selectDesk.cleanDossier')">
    <div class="ledger-2">
      <div class="panel clean-dossier">
        <h2>{{ t('selectDesk.cleanDossier') }}</h2>
        <p>fans {{ item.followers }} · {{ item.rating }} · {{ item.price?.amountMin }}</p>
        <p>{{ (item.categories || []).join(' / ') }}</p>
        <p>{{ item.hasCollaborated ? item.collabBrands?.join(', ') : '—' }}</p>
      </div>
      <aside class="panel hide-raw">
        <p>{{ t('selectDesk.hideRaw') }}</p>
        <p class="muted">{{ t('score.locked') }}</p>
      </aside>
    </div>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { request } = useApi()
const item = ref<any>({})
onMounted(async () => {
  item.value = await request(`/api/select/creators/${route.params.id}`)
})
</script>
