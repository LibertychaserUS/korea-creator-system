<template>
  <section>
    <p class="kcs-eyebrow">{{ t('kcs.overview.eyebrow') }}</p>
    <h1 class="kcs-title">{{ t('kcs.overview.title') }}</h1>
    <p class="kcs-lead">{{ t('kcs.overview.lead') }}</p>
    <p class="kcs-note">{{ t('kcs.toolbar.ruleFirst') }}</p>

    <div v-if="overview" class="kcs-stats">
      <div class="kcs-stat">
        <b class="kcs-data">{{ overview.creatorCount }}</b>
        <span>{{ t('kcs.overview.statCreators') }}</span>
      </div>
      <div class="kcs-stat">
        <b class="kcs-data">{{ overview.reviewCount }}</b>
        <span>{{ t('kcs.overview.statTop50') }}</span>
      </div>
      <div class="kcs-stat">
        <b class="kcs-data">{{ overview.recommendCount }}</b>
        <span>{{ t('kcs.overview.statRecommend') }}</span>
      </div>
      <div class="kcs-stat">
        <b class="kcs-data">{{ overview.cautiousCount }}</b>
        <span>{{ t('kcs.overview.statCautious') }}</span>
      </div>
      <div class="kcs-stat">
        <b class="kcs-data">{{ overview.rejectCount }}</b>
        <span>{{ t('kcs.overview.statReject') }}</span>
      </div>
    </div>

    <div v-if="overview && overview.top.length" class="kcs-table-wrap">
      <table class="kcs-table">
        <thead>
          <tr>
            <th>{{ t('kcs.creators.cols.rank') }}</th>
            <th>{{ t('kcs.creators.cols.creator') }}</th>
            <th>{{ t('kcs.creators.cols.score') }}</th>
            <th>{{ t('kcs.creators.cols.grade') }}</th>
            <th>{{ t('kcs.creators.cols.ai') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in overview.top" :key="row.creator.creatorKey">
            <td class="kcs-rank">{{ row.score.rank }}</td>
            <td>
              <div>{{ row.creator.nickname }}</div>
              <div class="kcs-cell-meta kcs-data">{{ row.creator.xhsId }}</div>
            </td>
            <td class="kcs-data">{{ row.score.final.toFixed(1) }}</td>
            <td><span class="kcs-chip">{{ row.score.grade }}</span></td>
            <td>
              <span v-if="row.aiReview" :class="['kcs-chip', chipClass(row.aiReview.decision)]">
                {{ t(`kcs.reviews.decision.${row.aiReview.decision}`) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="overview" class="kcs-empty">
      <h2>{{ t('kcs.overview.emptyTitle') }}</h2>
      <p>{{ t('kcs.overview.emptyBody') }}</p>
    </div>

    <NuxtLink :to="localePath('/creators')" class="kcs-link">
      {{ t('kcs.overview.nextAction') }}
    </NuxtLink>
  </section>
</template>

<script setup lang="ts">
import type { OverviewSnapshot } from '@libs/kcs-domain'

const { t } = useI18n()
const localePath = useLocalePath()
const { data: overview } = await useFetch<OverviewSnapshot>('/api/kcs/overview')

const chipClass = (decision: string) => {
  if (decision === 'recommend') return 'is-success'
  if (decision === 'reject') return 'is-danger'
  return 'is-warn'
}
</script>
