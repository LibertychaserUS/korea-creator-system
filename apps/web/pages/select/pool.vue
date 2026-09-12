<template>
  <ScreenFrame testid="screen-c-pool" :title="t('selectDesk.pool')">
    <div class="filters">
      <input data-testid="filter-followers" v-model="followersMin" :placeholder="t('home.draft')" />
      <input data-testid="filter-followers-min" v-model="followersMin" />
      <input data-testid="filter-followers-max" v-model="followersMax" />
      <input data-testid="filter-price" v-model="priceMax" />
      <input data-testid="filter-price-min" v-model="priceMin" />
      <input data-testid="filter-price-max" v-model="priceMax" />
      <select data-testid="filter-collab" v-model="hasCollaborated">
        <option value="any">any</option>
        <option value="true">yes</option>
        <option value="false">no</option>
      </select>
      <button data-testid="sort-followers" class="btn ghost" type="button" @click="applySort('followers')">
        {{ t('col.followers') }}
      </button>
      <button data-testid="sort-price" class="btn ghost" type="button" @click="applySort('price')">
        {{ t('col.quote') }}
      </button>
      <button data-testid="sort-collab" class="btn ghost" type="button" @click="applySort('collab_count')">
        {{ t('chip.collab') }}
      </button>
    </div>
    <div class="filter-chips">
      <span class="muted">{{ t('chip.grade') }}</span>
      <button
        v-for="g in grades"
        :key="g"
        class="chip-btn"
        data-testid="chip-grade"
        type="button"
        :aria-pressed="pickedGrades.includes(g) ? 'true' : 'false'"
        @click="toggle(pickedGrades, g)"
      >{{ g }}</button>
      <span class="muted">{{ t('chip.brand') }}</span>
      <button
        v-for="b in brands"
        :key="b"
        class="chip-btn"
        data-testid="chip-brand"
        type="button"
        :aria-pressed="pickedBrands.includes(b) ? 'true' : 'false'"
        @click="toggle(pickedBrands, b)"
      >{{ b }}</button>
      <button
        class="chip-btn"
        data-testid="chip-category"
        type="button"
        :aria-pressed="pickedCategories.includes('intending') ? 'true' : 'false'"
        @click="toggle(pickedCategories, 'intending')"
      >{{ t('chip.intending') }}</button>
      <button
        class="chip-btn"
        data-testid="chip-category"
        type="button"
        :aria-pressed="pickedCategories.includes('stale') ? 'true' : 'false'"
        @click="toggle(pickedCategories, 'stale')"
      >{{ t('chip.stale') }}</button>
      <span class="muted">{{ t('chip.collab') }}</span>
      <button
        class="chip-btn"
        data-testid="chip-collab"
        type="button"
        :aria-pressed="hasCollaborated === 'true' ? 'true' : 'false'"
        @click="setCollab('true')"
      >{{ t('chip.collabYes') }}</button>
      <button
        class="chip-btn"
        data-testid="chip-collab"
        type="button"
        :aria-pressed="hasCollaborated === 'false' ? 'true' : 'false'"
        @click="setCollab('false')"
      >{{ t('chip.collabNo') }}</button>
    </div>
    <table class="ledger-table" data-testid="table-pool">
      <thead>
        <tr>
          <th />
          <th>#</th>
          <th>{{ t('col.name') }}</th>
          <th>{{ t('chip.grade') }}</th>
          <th>{{ t('col.region') }}</th>
          <th>{{ t('col.followers') }}</th>
          <th>{{ t('col.quote') }}</th>
        </tr>
      </thead>
      <tbody>
      <tr
        v-for="row in items"
        :key="row.id"
        data-testid="row-pool"
        :data-creator-key="row.creatorKey"
      >
        <td>
          <input v-model="picked" data-testid="row-pool-check" type="checkbox" :value="row.id" />
        </td>
        <td>{{ row.rank || '—' }}</td>
        <td>
          <NuxtLink :to="localePath(`/select/creators/${row.id}`)">{{ row.displayName }}</NuxtLink>
        </td>
        <td>{{ row.grade ?? '—' }}</td>
        <td>{{ (row.regions || []).join(' / ') || '—' }}</td>
        <td>{{ row.followers }}</td>
        <td>{{ row.price?.amountMin ?? '—' }}</td>
      </tr>
      </tbody>
    </table>
    <p v-if="!items.length" class="muted">{{ t('emptyPool') }}</p>
    <template v-if="canAssign">
      <button class="btn" data-testid="btn-assign" type="button" :disabled="!picked.length" @click="confirming = true">
        {{ t('assign') }}
      </button>
      <button v-if="confirming" class="btn" data-testid="btn-assign-confirm" type="button" @click="assign">
        {{ t('assign') }}
      </button>
    </template>
  </ScreenFrame>
</template>

<script setup lang="ts">
import { BRAND_KEYWORDS, can, rankInCohort, scoreCreator, creatorToScoreInput } from '@kcs/contract'

const { t } = useI18n()
const { request } = useApi()
const { user } = useSession()
const localePath = useLocalePath()
const route = useRoute()
const items = ref<any[]>([])
const picked = ref<string[]>([])
const followersMin = ref('')
const followersMax = ref('')
const hasCollaborated = ref('any')
const priceMin = ref('')
const priceMax = ref('')
const sort = ref('rating')
const confirming = ref(false)
const pickedGrades = ref<string[]>([])
const pickedBrands = ref<string[]>([])
const pickedCategories = ref<string[]>([])
const grades = ['S', 'A', 'B', 'C']
const brands = [...new Set(BRAND_KEYWORDS)]
const canAssign = computed(() => Boolean(user.value && can(user.value.role, 'select.assign')))
let loadSeq = 0

function toggle(list: string[], value: string) {
  const i = list.indexOf(value)
  if (i >= 0) list.splice(i, 1)
  else list.push(value)
}

function setCollab(next: string) {
  hasCollaborated.value = hasCollaborated.value === next ? 'any' : next
}

async function load() {
  const mine = ++loadSeq
  const q = new URLSearchParams()
  if (followersMin.value) q.set('followersMin', followersMin.value)
  if (followersMax.value) q.set('followersMax', followersMax.value)
  if (hasCollaborated.value === 'true' || hasCollaborated.value === 'false') {
    q.set('hasCollaborated', hasCollaborated.value)
  }
  if (priceMin.value) q.set('priceMin', priceMin.value)
  if (priceMax.value) q.set('priceMax', priceMax.value)
  if (pickedGrades.value.length) q.set('grade', pickedGrades.value.join(','))
  if (pickedBrands.value.length) q.set('brand', pickedBrands.value.join(','))
  if (pickedCategories.value.length) q.set('categories', pickedCategories.value.join(','))
  q.set('sort', sort.value)
  const rows = (await request<any>(`/api/select/pool?${q}`)).items
  if (mine !== loadSeq) return
  const finals = rows.map((row: any) => Number(row.final ?? scoreCreator(creatorToScoreInput(row)).final))
  items.value = rows.map((row: any, index: number) => ({
    ...row,
    rank: rankInCohort(finals[index], finals),
  }))
}

function applySort(next: string) {
  sort.value = next
  load()
}

async function assign() {
  const project = String(route.query.project || '')
  await request(`/api/select/projects/${project}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ creatorIds: picked.value }),
  })
  confirming.value = false
  await navigateTo(localePath(`/select/projects/${project}`))
}

onMounted(load)
watch(
  [followersMin, followersMax, hasCollaborated, priceMin, priceMax, pickedGrades, pickedBrands, pickedCategories],
  () => {
    load()
  },
  { deep: true },
)
</script>
