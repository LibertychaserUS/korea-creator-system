<template>
  <section>
    <p class="kcs-eyebrow">{{ t('kcs.reviews.eyebrow') }}</p>
    <h1 class="kcs-title">{{ t('kcs.reviews.title') }}</h1>
    <p class="kcs-lead">{{ t('kcs.reviews.lead') }}</p>
    <p class="kcs-note">{{ t('kcs.exempt.note') }}</p>

    <div v-if="items.length" class="kcs-cards">
      <article v-for="row in items" :key="row.creator.creatorKey" class="kcs-card">
        <div class="kcs-rank">{{ row.score.rank }}</div>
        <div>
          <h2>{{ row.creator.nickname }}</h2>
          <p class="kcs-cell-meta kcs-data">{{ row.creator.xhsId }} · {{ row.score.final.toFixed(1) }} · {{ row.score.grade }}</p>
          <p>
            <span :class="['kcs-chip', chipClass(row.aiReview.decision)]">
              {{ t(`kcs.reviews.decision.${row.aiReview.decision}`) }}
            </span>
            <span class="kcs-chip">{{ t(`kcs.reviews.source.${row.aiReview.source}`) }}</span>
          </p>
          <p><strong>{{ t('kcs.reviews.fields.reason') }}</strong> {{ row.aiReview.reason }}</p>
          <p class="kcs-note"><strong>{{ t('kcs.reviews.fields.risk') }}</strong> {{ row.aiReview.riskNote }}</p>
          <p class="kcs-note">
            <strong>{{ t('kcs.reviews.fields.alignment') }}</strong>
            {{ t(`kcs.reviews.alignment.${row.aiReview.alignment}`) }}
          </p>
        </div>
      </article>
    </div>

    <div v-else class="kcs-empty">
      <h2>{{ t('kcs.reviews.emptyTitle') }}</h2>
      <p>{{ t('kcs.reviews.emptyBody') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CreatorRow } from '@libs/kcs-domain'

const { t } = useI18n()
const { data } = await useFetch<{ items: Array<CreatorRow & { aiReview: NonNullable<CreatorRow['aiReview']> }> }>('/api/kcs/reviews')
const items = computed(() => data.value?.items ?? [])

const chipClass = (decision: string) => {
  if (decision === 'recommend') return 'is-success'
  if (decision === 'reject') return 'is-danger'
  return 'is-warn'
}
</script>
