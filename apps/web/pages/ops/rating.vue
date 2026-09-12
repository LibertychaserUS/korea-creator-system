<template>
  <ScreenFrame testid="screen-a-score-preview" :title="t('score.title')">
    <p class="muted">{{ t('score.readonly') }} · {{ t('score.locked') }}</p>
    <div v-for="row in items" :key="row.id" class="panel ledger-2">
      <div>
        <h2>{{ row.displayName }} · {{ preview(row).grade }} · {{ preview(row).final }}</h2>
        <p class="muted">{{ t('score.engine') }} {{ preview(row).ruleVersion }}</p>
        <div v-for="dim in preview(row).dimensions" :key="dim.id" class="score-bar">
          <span>{{ t(labelOf(dim.id)) }}</span>
          <div class="bar"><i :style="{ width: (dim.contribution / dim.weight) * 100 + '%' }" /></div>
          <span>{{ dim.contribution }}/{{ dim.weight }}</span>
        </div>
        <div class="score-bar">
          <span>{{ t('score.risk') }}</span>
          <div class="bar"><i style="width: 8%; background: var(--bad)" /></div>
          <span>{{ preview(row).riskDeduction }}</span>
        </div>
        <p>{{ t('score.formula') }} {{ preview(row).formula }}</p>
      </div>
      <aside>
        <h2>{{ t('score.hits') }}</h2>
        <p>{{ preview(row).hits.join(' ') || '—' }}</p>
        <p class="muted">{{ t('score.grades') }} S≥85 A≥75 B≥65</p>
      </aside>
    </div>
    <p v-if="!items.length" class="muted">—</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
import { RULE_DIMENSIONS, creatorToScoreInput, scoreCreator } from '@kcs/contract'

const { t } = useI18n()
const { request } = useApi()
const items = ref<any[]>([])
const cache = new Map<string, ReturnType<typeof scoreCreator>>()

onMounted(async () => {
  items.value = (await request<any>('/api/ops/creators')).items || []
})

function preview(row: any) {
  if (!cache.has(row.id)) cache.set(row.id, scoreCreator(creatorToScoreInput(row)))
  return cache.get(row.id)!
}

function labelOf(id: string) {
  return RULE_DIMENSIONS.find((d) => d.id === id)?.labelKey || id
}
</script>
