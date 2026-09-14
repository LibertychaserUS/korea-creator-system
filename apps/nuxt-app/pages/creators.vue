<template>
  <section>
    <p class="kcs-eyebrow">{{ t('kcs.creators.eyebrow') }}</p>
    <h1 class="kcs-title">{{ t('kcs.creators.title') }}</h1>
    <p class="kcs-lead">{{ t('kcs.creators.lead') }}</p>
    <p class="kcs-note">{{ t('kcs.exempt.note') }}</p>

    <input
      v-model="query"
      class="kcs-search"
      type="search"
      :placeholder="t('kcs.creators.search')"
      :aria-label="t('kcs.creators.search')"
    >

    <div v-if="filtered.length" class="kcs-table-wrap">
      <table class="kcs-table">
        <thead>
          <tr>
            <th>{{ t('kcs.creators.cols.rank') }}</th>
            <th>{{ t('kcs.creators.cols.creator') }}</th>
            <th>{{ t('kcs.creators.cols.score') }}</th>
            <th>{{ t('kcs.creators.cols.grade') }}</th>
            <th>{{ t('kcs.creators.cols.fans') }}</th>
            <th>{{ t('kcs.creators.cols.ai') }}</th>
            <th>{{ t('kcs.creators.cols.manual') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in filtered" :key="row.creator.creatorKey">
            <td class="kcs-rank">{{ row.score.rank }}</td>
            <td>
              <div>{{ row.creator.nickname }}</div>
              <div class="kcs-cell-meta kcs-data">{{ row.creator.xhsId }}</div>
            </td>
            <td class="kcs-data">{{ row.score.final.toFixed(1) }}</td>
            <td><span class="kcs-chip">{{ row.score.grade }}</span></td>
            <td class="kcs-data">{{ row.creator.fans.toLocaleString() }}</td>
            <td>
              <span v-if="row.aiReview" :class="['kcs-chip', chipClass(row.aiReview.decision)]">
                {{ t(`kcs.reviews.decision.${row.aiReview.decision}`) }}
              </span>
            </td>
            <td>
              {{ row.manualReview?.decision ? t(`kcs.manual.${row.manualReview.decision}`) : t('kcs.manual.none') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="kcs-empty">
      <h2>{{ t('kcs.creators.emptyTitle') }}</h2>
      <p>{{ t('kcs.creators.emptyBody') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CreatorRow } from '@libs/kcs-domain'

const { t } = useI18n()
const query = ref('')
const { data } = await useFetch<{ items: CreatorRow[] }>('/api/kcs/creators')

const filtered = computed(() => {
  const items = data.value?.items ?? []
  const needle = query.value.trim().toLowerCase()
  if (!needle) return items
  return items.filter((row) => {
    const nick = row.creator.nickname.toLowerCase()
    const id = row.creator.xhsId.toLowerCase()
    return nick.includes(needle) || id.includes(needle)
  })
})

const chipClass = (decision: string) => {
  if (decision === 'recommend') return 'is-success'
  if (decision === 'reject') return 'is-danger'
  return 'is-warn'
}
</script>
