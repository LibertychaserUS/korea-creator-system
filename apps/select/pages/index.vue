<template>
  <PanelPage testid="screen-c-pool" :title="t('kcs.panel.pool')" :eyebrow="t('kcs.nav.select')">
    <Card>
      <CardContent class="flex flex-wrap items-end gap-3 pt-6">
        <div class="grid gap-1">
          <Label class="text-xs">{{ t('kcs.panel.followers') }} min</Label>
          <Input data-testid="filter-followers" v-model="followersMin" class="w-28" />
        </div>
        <Input data-testid="filter-followers-min" v-model="followersMin" class="w-28" />
        <Input data-testid="filter-followers-max" v-model="followersMax" class="w-28" />
        <Input data-testid="filter-price" v-model="priceMax" class="w-28" />
        <Input data-testid="filter-price-min" v-model="priceMin" class="w-28" />
        <Input data-testid="filter-price-max" v-model="priceMax" class="w-28" />
        <select
          data-testid="filter-collab"
          v-model="hasCollaborated"
          class="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="any">any</option>
          <option value="true">yes</option>
          <option value="false">no</option>
        </select>
        <Button data-testid="sort-followers" variant="outline" type="button" @click="applySort('followers')">
          {{ t('kcs.creators.cols.fans') }}
        </Button>
        <Button data-testid="sort-price" variant="outline" type="button" @click="applySort('price')">
          {{ t('kcs.panel.quote') }}
        </Button>
        <Button data-testid="sort-collab" variant="outline" type="button" @click="applySort('collab_count')">
          {{ t('kcs.panel.collaborated') }}
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="pt-6">
        <Table data-testid="table-pool">
          <TableHeader>
            <TableRow>
              <TableHead class="w-10" />
              <TableHead>#</TableHead>
              <TableHead>{{ t('kcs.creators.cols.creator') }}</TableHead>
              <TableHead>{{ t('kcs.creators.cols.grade') }}</TableHead>
              <TableHead>{{ t('kcs.creators.cols.fans') }}</TableHead>
              <TableHead>{{ t('kcs.panel.quote') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in items"
              :key="row.id"
              data-testid="row-pool"
              :data-creator-key="row.creatorKey"
            >
              <TableCell>
                <input v-model="picked" data-testid="row-pool-check" type="checkbox" :value="row.id" />
              </TableCell>
              <TableCell>{{ row.rank || '—' }}</TableCell>
              <TableCell>{{ row.displayName }}</TableCell>
              <TableCell>{{ row.grade ?? '—' }}</TableCell>
              <TableCell>{{ row.followers }}</TableCell>
              <TableCell>{{ row.price?.amountMin ?? '—' }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p v-if="!items.length" class="mt-4 text-sm text-muted-foreground">{{ t('kcs.panel.emptyPool') }}</p>
        <div v-if="canAssign" class="mt-4 flex gap-2">
          <Button data-testid="btn-assign" type="button" :disabled="!picked.length" @click="confirming = true">
            {{ t('kcs.panel.assign') }}
          </Button>
          <Button v-if="confirming" data-testid="btn-assign-confirm" type="button" @click="assign">
            {{ t('kcs.panel.confirmAssign') }}
          </Button>
        </div>
      </CardContent>
    </Card>
  </PanelPage>
</template>

<script setup lang="ts">
import { can, rankInCohort, scoreCreator, creatorToScoreInput } from '@kcs/contract'

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
const canAssign = computed(() => Boolean(user.value && can(user.value.role, 'select.assign')))
let loadSeq = 0

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
  await navigateTo(localePath(`/projects/${project}`))
}

onMounted(load)
watch([followersMin, followersMax, hasCollaborated, priceMin, priceMax], () => load())
</script>
