<template>
  <ScreenFrame testid="screen-c-shortlist" :title="`${t('selectDesk.shortlist')} · 短名单`">
    <div class="ledger-2">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>{{ t('col.rank') }}</th>
            <th>{{ t('col.name') }}</th>
            <th>{{ t('col.score') }}</th>
            <th class="quote-col">{{ t('col.quote') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in items" :key="`${row.org_id}-${row.creator_id}`">
            <td>{{ index + 1 }}</td>
            <td>{{ row.displayName || row.display_name }}</td>
            <td>{{ row.final ?? row.rating ?? '—' }}</td>
            <td class="quote-col">{{ row.price?.amountMin ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
      <aside class="panel">
        <div class="muted">{{ t('selectDesk.quoteSum') }}</div>
        <div class="quote-sum">{{ totalLabel }}</div>
        <p class="muted">{{ t('selectDesk.budgetNote') }}</p>
        <p class="muted">{{ t('selectDesk.shortlist') }}</p>
      </aside>
    </div>
    <p v-if="!items.length" class="muted">—</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
import { quoteSum } from '@kcs/contract'

const { t } = useI18n()
const { request } = useApi()
const items = ref<any[]>([])
const total = computed(() => quoteSum(items.value))
const totalLabel = computed(() => (total.value ? `¥${total.value.toLocaleString()}` : '—'))
onMounted(async () => {
  items.value = (await request<any>('/api/select/shortlist')).items || []
})
</script>
