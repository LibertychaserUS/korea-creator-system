<template>
  <ScreenFrame testid="screen-c-shortlist" :title="`${t('selectDesk.shortlist')} · 短名单`">
    <div class="ledger-2">
      <table class="ledger-table">
        <thead>
          <tr><th>{{ t('selectDesk.shortlist') }}</th><th>time</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="`${row.org_id}-${row.creator_id}`">
            <td>{{ row.display_name }}</td>
            <td>{{ row.added_at }}</td>
          </tr>
        </tbody>
      </table>
      <aside class="panel">
        <div class="muted">{{ t('selectDesk.quoteSum') }}</div>
        <div class="quote-sum">—</div>
        <p class="muted">{{ t('selectDesk.shortlist') }}</p>
      </aside>
    </div>
    <p v-if="!items.length" class="muted">—</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { request } = useApi()
const items = ref<any[]>([])
onMounted(async () => {
  items.value = (await request<any>('/api/select/shortlist')).items || []
})
</script>
