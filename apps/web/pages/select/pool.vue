<template>
  <ScreenFrame testid="screen-c-pool" title="整理后的达人库">
    <div class="filters">
      <input data-testid="filter-followers" v-model="followersMin" placeholder="最低粉丝" />
      <input data-testid="filter-followers-min" v-model="followersMin" placeholder="最低粉丝" />
      <input data-testid="filter-followers-max" v-model="followersMax" placeholder="最高粉丝" />
      <input data-testid="filter-price" v-model="priceMax" placeholder="最高报价" />
      <input data-testid="filter-price-min" v-model="priceMin" placeholder="最低报价" />
      <input data-testid="filter-price-max" v-model="priceMax" placeholder="最高报价" />
      <select data-testid="filter-collab" v-model="hasCollaborated">
        <option value="any">不限</option>
        <option value="true">合作过</option>
        <option value="false">没合作过</option>
      </select>
      <button data-testid="sort-followers" class="btn ghost" type="button" @click="applySort('followers')">粉丝</button>
      <button data-testid="sort-price" class="btn ghost" type="button" @click="applySort('price')">报价</button>
      <button data-testid="sort-collab" class="btn ghost" type="button" @click="applySort('collab_count')">合作</button>
    </div>
    <table data-testid="table-pool">
      <tr
        v-for="row in items"
        :key="row.id"
        data-testid="row-pool"
        :data-creator-key="row.creatorKey"
      >
        <td>
          <input v-model="picked" data-testid="row-pool-check" type="checkbox" :value="row.id" />
        </td>
        <td>
          <NuxtLink :to="localePath(`/select/creators/${row.id}`)">{{ row.displayName }}</NuxtLink>
        </td>
        <td>{{ row.followers }}</td>
        <td>{{ row.price?.amountMin }}</td>
      </tr>
    </table>
    <template v-if="canAssign">
      <button class="btn" data-testid="btn-assign" type="button" :disabled="!picked.length" @click="confirming = true">
        分配到项目
      </button>
      <button v-if="confirming" class="btn" data-testid="btn-assign-confirm" type="button" @click="assign">
        确认分配
      </button>
    </template>
  </ScreenFrame>
</template>

<script setup lang="ts">
import { can } from '@kcs/contract'

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
const canAssign = computed(() => Boolean(user.value && can(user.value.role, 'select.assign')))

async function load() {
  const q = new URLSearchParams()
  if (followersMin.value) q.set('followersMin', followersMin.value)
  if (followersMax.value) q.set('followersMax', followersMax.value)
  if (hasCollaborated.value === 'true' || hasCollaborated.value === 'false') {
    q.set('hasCollaborated', hasCollaborated.value)
  }
  if (priceMin.value) q.set('priceMin', priceMin.value)
  if (priceMax.value) q.set('priceMax', priceMax.value)
  q.set('sort', sort.value)
  items.value = (await request<any>(`/api/select/pool?${q}`)).items
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
watch([followersMin, followersMax, hasCollaborated, priceMin, priceMax], () => {
  load()
})
</script>
