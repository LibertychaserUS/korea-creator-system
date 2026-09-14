<template>
  <PanelPage
    testid="screen-c-pool"
    :title="t('kcs.panel.pool')"
    :eyebrow="t('kcs.nav.select')"
    :lead="t('kcs.query.lead')"
  >
    <template #actions>
      <Button v-if="projectId" as-child variant="outline" size="sm">
        <NuxtLink :to="localePath(`/projects/${projectId}`)">
          <ArrowLeft class="size-4" />
          {{ projectName || t('kcs.panel.back') }}
        </NuxtLink>
      </Button>
    </template>

    <div
      v-if="projectId"
      class="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
      data-testid="pool-project-context"
    >
      <span class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
        <FolderKanban class="size-4" />
      </span>
      <span class="text-foreground">{{ t('kcs.panel.assignTo', { name: projectName || t('kcs.panel.untitled') }) }}</span>
      <span class="ml-auto tabular-nums text-muted-foreground">{{ t('kcs.panel.picked', { n: picked.length }) }}</span>
    </div>

    <!-- 方案栏：已保存方案 + 快捷过滤 + 编辑器 -->
    <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="query-bar">
      <div class="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
        <Bookmark class="size-4 text-primary" aria-hidden="true" />
        <span class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{{ t('kcs.query.title') }}</span>
        <div class="flex flex-wrap items-center gap-1.5" role="tablist" :aria-label="t('kcs.query.title')">
          <button
            v-for="q in savedQueries"
            :key="q.id"
            type="button"
            role="tab"
            class="h-8 rounded-md border px-3 text-xs font-medium transition-colors"
            :class="activeId === q.id && !dirty ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted'"
            :aria-selected="activeId === q.id && !dirty"
            :data-testid="`query-tab-${q.id}`"
            @click="selectQuery(q)"
          >
            {{ q.name }}
            <span class="ml-1 font-mono text-[10px] opacity-70">{{ t('kcs.query.version', { n: q.version }) }}</span>
          </button>
          <span
            v-if="dirty"
            class="inline-flex h-8 items-center rounded-md border border-dashed border-primary/50 px-3 text-xs font-medium text-primary"
            data-testid="query-tab-unsaved"
          >
            {{ activeId ? `${activeName} *` : t('kcs.query.unsaved') }}
          </span>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" class="h-8" data-testid="query-new" @click="newQuery">
            <Plus class="size-3.5" />
            {{ t('kcs.query.new') }}
          </Button>
          <Button
            :variant="editorOpen ? 'secondary' : 'outline'"
            size="sm"
            class="h-8"
            data-testid="query-editor-toggle"
            :aria-expanded="editorOpen"
            @click="editorOpen = !editorOpen"
          >
            <SlidersHorizontal class="size-3.5" />
            {{ editorOpen ? t('kcs.query.close') : t('kcs.query.editor') }}
          </Button>
        </div>
      </div>

      <!-- 快捷过滤：量级 / 健康等级 / 排序 / 搜索 -->
      <div class="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[auto_auto_1fr_auto] lg:items-end">
        <fieldset data-testid="filter-tier" class="min-w-0">
          <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.query.tiers') }}</legend>
          <div class="inline-flex flex-wrap rounded-md border border-border bg-muted/40 p-0.5" role="group">
            <button
              type="button"
              class="h-8 rounded-[6px] px-3 text-xs font-medium transition-colors"
              :class="!spec.tiers.length ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
              :aria-pressed="!spec.tiers.length"
              @click="spec.tiers = []"
            >
              {{ t('kcs.query.anyTier') }}
            </button>
            <button
              v-for="tier in tierIds"
              :key="tier"
              type="button"
              class="h-8 rounded-[6px] px-3 text-xs font-medium transition-colors"
              :class="spec.tiers.includes(tier) ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
              :aria-pressed="spec.tiers.includes(tier)"
              :data-testid="`filter-tier-${tier}`"
              @click="toggleIn(spec.tiers, tier)"
            >
              {{ t(`kcs.tier.${tier}`) }}
            </button>
          </div>
        </fieldset>

        <fieldset data-testid="filter-health" class="min-w-0">
          <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.query.health') }}</legend>
          <div class="inline-flex flex-wrap rounded-md border border-border bg-muted/40 p-0.5" role="group">
            <button
              type="button"
              class="h-8 rounded-[6px] px-3 text-xs font-medium transition-colors"
              :class="!spec.health.length ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
              :aria-pressed="!spec.health.length"
              @click="spec.health = []"
            >
              {{ t('kcs.query.anyHealth') }}
            </button>
            <button
              v-for="h in healthIds"
              :key="h"
              type="button"
              class="h-8 rounded-[6px] px-3 text-xs font-medium transition-colors"
              :class="spec.health.includes(h) ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
              :aria-pressed="spec.health.includes(h)"
              :data-testid="`filter-health-${h}`"
              @click="toggleIn(spec.health, h)"
            >
              {{ t(`kcs.health.${h}`) }}
            </button>
          </div>
        </fieldset>

        <div class="min-w-0">
          <Label for="pool-search" class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.creators.search') }}</Label>
          <div class="relative">
            <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="pool-search" v-model="search" data-testid="pool-search" class="h-9 pl-8" :placeholder="t('kcs.creators.search')" />
          </div>
        </div>

        <div class="min-w-0">
          <Label for="pool-sort" class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.query.sort') }}</Label>
          <div class="flex items-center gap-1.5">
            <div class="relative">
              <select
                id="pool-sort"
                v-model="spec.sort.key"
                data-testid="sort-key"
                class="border-input h-9 w-44 appearance-none rounded-md border bg-transparent pl-3 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option v-for="key in sortableKeys" :key="key" :value="key">{{ label(key) }}</option>
              </select>
              <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <Button
              variant="outline"
              size="icon"
              class="size-9"
              data-testid="sort-dir"
              :title="spec.sort.dir === 'asc' ? t('kcs.query.asc') : t('kcs.query.desc')"
              @click="spec.sort.dir = spec.sort.dir === 'asc' ? 'desc' : 'asc'"
            >
              <ArrowUpNarrowWide v-if="spec.sort.dir === 'asc'" class="size-4" />
              <ArrowDownWideNarrow v-else class="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <!-- 方案编辑器 -->
      <div v-if="editorOpen" class="grid gap-6 border-t border-border/60 bg-muted/20 px-4 py-5 sm:px-5 lg:grid-cols-[1fr_1fr_minmax(16rem,0.8fr)]" data-testid="query-editor">
        <section class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">{{ t('kcs.query.filters') }}</h3>
            <Button variant="ghost" size="sm" class="h-7 text-xs" data-testid="query-add-filter" @click="addFilter">
              <Plus class="size-3.5" />
              {{ t('kcs.query.addFilter') }}
            </Button>
          </div>
          <p v-if="!spec.filters.length" class="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
            {{ t('kcs.query.noFilters') }}
          </p>
          <div v-for="(f, i) in spec.filters" :key="i" class="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1.5" :data-testid="`query-filter-${i}`">
            <select v-model="f.key" class="border-input h-8 min-w-0 rounded-md border bg-background px-2 text-xs shadow-xs outline-none">
              <option v-for="key in metricKeys" :key="key" :value="key">{{ label(key) }}</option>
            </select>
            <select v-model="f.op" class="border-input h-8 rounded-md border bg-background px-2 text-xs shadow-xs outline-none" @change="onOpChange(f)">
              <option value="gte">{{ t('kcs.query.op.gte') }}</option>
              <option value="lte">{{ t('kcs.query.op.lte') }}</option>
              <option value="between">{{ t('kcs.query.op.between') }}</option>
              <option value="percentileGte">{{ t('kcs.query.op.percentileGte') }}</option>
            </select>
            <div v-if="f.op === 'between'" class="flex min-w-0 items-center gap-1">
              <Input v-model.number="(f.value as [number, number])[0]" type="number" step="any" class="h-8 min-w-0 px-2 text-xs tabular-nums" :aria-label="t('kcs.query.from')" />
              <span class="text-muted-foreground/60">–</span>
              <Input v-model.number="(f.value as [number, number])[1]" type="number" step="any" class="h-8 min-w-0 px-2 text-xs tabular-nums" :aria-label="t('kcs.query.to')" />
            </div>
            <Input
              v-else
              v-model.number="f.value"
              type="number"
              step="any"
              class="h-8 min-w-0 px-2 text-xs tabular-nums"
              :aria-label="t('kcs.query.value')"
              :placeholder="f.op === 'percentileGte' ? '75' : unitHint(f.key)"
            />
            <Button variant="ghost" size="icon" class="size-8 text-muted-foreground" :aria-label="t('kcs.query.removeFilter')" @click="spec.filters.splice(i, 1)">
              <X class="size-3.5" />
            </Button>
          </div>
        </section>

        <section class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">{{ t('kcs.query.highlights') }}</h3>
            <Button variant="ghost" size="sm" class="h-7 text-xs" @click="spec.highlights.push({ key: 'cpe', op: 'lte', value: 3, tone: 'good' })">
              <Plus class="size-3.5" />
              {{ t('kcs.query.addFilter') }}
            </Button>
          </div>
          <div v-for="(h, i) in spec.highlights" :key="i" class="grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-1.5">
            <select v-model="h.key" class="border-input h-8 min-w-0 rounded-md border bg-background px-2 text-xs shadow-xs outline-none">
              <option v-for="key in metricKeys" :key="key" :value="key">{{ label(key) }}</option>
            </select>
            <select v-model="h.op" class="border-input h-8 rounded-md border bg-background px-2 text-xs shadow-xs outline-none">
              <option value="gte">{{ t('kcs.query.op.gte') }}</option>
              <option value="lte">{{ t('kcs.query.op.lte') }}</option>
            </select>
            <Input v-model.number="h.value" type="number" step="any" class="h-8 min-w-0 px-2 text-xs tabular-nums" />
            <select v-model="h.tone" class="border-input h-8 rounded-md border bg-background px-2 text-xs shadow-xs outline-none">
              <option value="good">{{ t('kcs.query.tone.good') }}</option>
              <option value="warn">{{ t('kcs.query.tone.warn') }}</option>
              <option value="bad">{{ t('kcs.query.tone.bad') }}</option>
            </select>
            <Button variant="ghost" size="icon" class="size-8 text-muted-foreground" :aria-label="t('kcs.query.removeFilter')" @click="spec.highlights.splice(i, 1)">
              <X class="size-3.5" />
            </Button>
          </div>

          <h3 class="mt-2 text-sm font-semibold">{{ t('kcs.query.columns') }}</h3>
          <div class="flex flex-wrap gap-1.5" data-testid="query-columns">
            <button
              v-for="key in metricKeys"
              :key="key"
              type="button"
              class="h-7 rounded-md border px-2 text-[11px] font-medium transition-colors"
              :class="spec.columns.includes(key) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'"
              :aria-pressed="spec.columns.includes(key)"
              :title="help(key)"
              @click="toggleColumn(key)"
            >
              {{ label(key) }}
            </button>
          </div>
        </section>

        <section class="flex flex-col gap-3 lg:border-l lg:border-border/60 lg:pl-6">
          <h3 class="text-sm font-semibold">{{ activeId ? activeName : t('kcs.query.new') }}</h3>
          <div>
            <Label for="query-name" class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.query.name') }}</Label>
            <Input id="query-name" v-model="spec.name" data-testid="query-name" class="h-9" :placeholder="t('kcs.query.namePlaceholder')" />
          </div>
          <ul v-if="errors.length" class="space-y-1 text-xs text-destructive" data-testid="query-errors">
            <li v-for="e in errors" :key="e">{{ te(`kcs.query.errors.${e}`) ? t(`kcs.query.errors.${e}`) : e }}</li>
          </ul>
          <div class="flex flex-wrap gap-2">
            <Button v-if="canWrite" size="sm" data-testid="query-save" :disabled="saving || !spec.name.trim()" @click="save(false)">
              <Save class="size-3.5" />
              {{ t('kcs.query.save') }}
            </Button>
            <Button v-if="canWrite && activeId" size="sm" variant="outline" data-testid="query-save-as" :disabled="saving" @click="save(true)">
              {{ t('kcs.query.saveAs') }}
            </Button>
            <Button size="sm" variant="ghost" @click="resetSpec">{{ t('kcs.query.reset') }}</Button>
            <Button v-if="canWrite && activeId" size="sm" variant="ghost" class="text-destructive hover:text-destructive" data-testid="query-delete" @click="remove">
              <Trash2 class="size-3.5" />
              {{ t('kcs.query.delete') }}
            </Button>
          </div>
          <p v-if="notice" class="text-xs text-muted-foreground" data-testid="query-notice">{{ notice }}</p>
          <p class="text-xs leading-relaxed text-muted-foreground">{{ t('kcs.tier.hint') }}</p>
        </section>
      </div>
    </Card>

    <!-- 达人表：列由方案决定 -->
    <TableCard :title="t('kcs.panel.pool')" dense>
      <template #meta>
        <span class="tabular-nums" data-testid="pool-count">{{ t('kcs.query.matched', { n: formatNumber(visible.length) }) }}</span>
      </template>

      <!-- 手机：卡片 -->
      <ul class="divide-y divide-border/60 md:hidden">
        <template v-if="loading && !visible.length">
          <li v-for="i in 4" :key="`msk-${i}`" class="flex items-start gap-3 px-4 py-3">
            <Skeleton class="size-9 rounded-full" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-32" />
              <Skeleton class="h-3 w-24" />
              <Skeleton class="h-8 w-full" />
            </div>
          </li>
        </template>
        <li
          v-for="row in visible"
          :key="`m-${row.id}`"
          class="flex items-start gap-3 px-4 py-3 transition-colors data-[state=selected]:bg-primary/5"
          :class="canAssign ? 'cursor-pointer active:bg-muted/60' : ''"
          :data-state="picked.includes(row.id) ? 'selected' : undefined"
          @click="canAssign && toggle(row.id)"
        >
          <input
            v-if="canAssign"
            v-model="picked"
            type="checkbox"
            :value="row.id"
            :aria-label="row.displayName"
            class="mt-2.5 size-4 shrink-0 rounded border-input accent-primary"
            @click.stop
          />
          <Avatar class="size-9 border border-border">
            <AvatarFallback class="bg-muted text-xs text-muted-foreground">{{ row.displayName?.charAt(0) }}</AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-medium text-foreground">{{ row.displayName }}</span>
              <HealthBadge :health="row.metrics?.health" />
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-1.5">
              <TierBadge :tier="row.tier" />
              <SourceBadge :source="row.source" />
            </div>
            <dl class="mt-2.5 grid grid-cols-3 gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
              <div v-for="key in spec.columns.slice(0, 3)" :key="key" class="min-w-0">
                <dt class="truncate text-muted-foreground">{{ label(key) }}</dt>
                <dd class="font-semibold">
                  <MetricValue :metric-key="key" :value="row.metrics?.[key]" :band="row.percentiles?.[key]?.band" :percentile="row.percentiles?.[key]?.percentile" compact />
                </dd>
              </div>
            </dl>
          </div>
        </li>
      </ul>

      <div class="hidden md:block">
        <Table data-testid="table-pool">
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead v-if="canAssign" class="w-10"><span class="sr-only">{{ t('kcs.panel.assign') }}</span></TableHead>
              <TableHead class="min-w-48">{{ t('kcs.creators.cols.creator') }}</TableHead>
              <TableHead class="w-20">{{ t('kcs.tier.label') }}</TableHead>
              <TableHead class="w-20">{{ t('kcs.health.label') }}</TableHead>
              <TableHead
                v-for="key in spec.columns"
                :key="key"
                class="text-right"
                :class="spec.sort.key === key ? 'text-foreground' : ''"
                :title="help(key)"
              >
                <button type="button" class="inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground" @click="sortBy(key)">
                  {{ label(key) }}
                  <ArrowUpNarrowWide v-if="spec.sort.key === key && spec.sort.dir === 'asc'" class="size-3" />
                  <ArrowDownWideNarrow v-else-if="spec.sort.key === key" class="size-3" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="loading && !visible.length">
              <TableRow v-for="i in 6" :key="`sk-${i}`" class="hover:bg-transparent">
                <TableCell v-if="canAssign"><Skeleton class="size-4" /></TableCell>
                <TableCell><Skeleton class="h-4 w-40" /></TableCell>
                <TableCell><Skeleton class="h-5 w-12" /></TableCell>
                <TableCell><Skeleton class="h-5 w-12" /></TableCell>
                <TableCell v-for="key in spec.columns" :key="key"><Skeleton class="ml-auto h-4 w-14" /></TableCell>
              </TableRow>
            </template>
            <TableRow
              v-for="row in visible"
              :key="row.id"
              data-testid="row-pool"
              :data-creator-key="row.creatorKey"
              :data-state="picked.includes(row.id) ? 'selected' : undefined"
              class="group"
              :class="canAssign ? 'cursor-pointer' : ''"
              @click="canAssign && toggle(row.id)"
            >
              <TableCell v-if="canAssign" @click.stop>
                <input v-model="picked" data-testid="row-pool-check" type="checkbox" :value="row.id" :aria-label="row.displayName" class="size-4 rounded border-input accent-primary" />
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-3">
                  <Avatar class="size-8 border border-border">
                    <AvatarFallback class="bg-muted text-xs text-muted-foreground">{{ row.displayName?.charAt(0) }}</AvatarFallback>
                  </Avatar>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <NuxtLink :to="localePath(`/creators/${row.id}`)" class="truncate font-medium text-foreground underline-offset-4 hover:underline" @click.stop>
                        {{ row.displayName }}
                      </NuxtLink>
                      <span
                        v-for="flag in row.flags"
                        :key="flag.key"
                        class="size-1.5 rounded-full"
                        :class="flag.tone === 'good' ? 'bg-emerald-500' : flag.tone === 'warn' ? 'bg-amber-500' : 'bg-destructive'"
                        :title="`${label(flag.key)} · ${t(`kcs.query.tone.${flag.tone}`)}`"
                      />
                    </div>
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <SourceBadge :source="row.source" class="h-5 border-0 bg-transparent px-0" />
                      <span v-if="row.regions?.length" class="truncate">· {{ row.regions.slice(0, 2).join(' · ') }}</span>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell><TierBadge :tier="row.tier" /></TableCell>
              <TableCell><HealthBadge :health="row.metrics?.health" /></TableCell>
              <TableCell v-for="key in spec.columns" :key="key" class="text-right text-[13px]">
                <MetricValue :metric-key="key" :value="row.metrics?.[key]" :band="row.percentiles?.[key]?.band" :percentile="row.percentiles?.[key]?.percentile" compact />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <EmptyState v-if="!loading && !visible.length" :title="t('kcs.query.noResult')" :body="t('kcs.query.lead')">
        <Button variant="outline" size="sm" @click="resetSpec">{{ t('kcs.query.reset') }}</Button>
      </EmptyState>

      <template v-if="canAssign" #footer>
        <div class="flex flex-wrap items-center gap-3">
          <template v-if="projectId">
            <Button data-testid="btn-assign" type="button" :disabled="!picked.length" @click="confirming = true">
              <UserPlus class="size-4" />
              {{ t('kcs.panel.assign') }}
            </Button>
            <Button v-if="confirming" data-testid="btn-assign-confirm" type="button" variant="secondary" :disabled="assigning" @click="assign">
              <Check class="size-4" />
              {{ t('kcs.panel.confirmAssign') }}
            </Button>
            <span class="text-sm tabular-nums text-muted-foreground">{{ t('kcs.panel.picked', { n: picked.length }) }}</span>
          </template>
          <p v-else class="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <Info class="size-4" />
            {{ t('kcs.panel.assignHint') }}
            <NuxtLink :to="localePath('/projects')" class="ml-1 font-medium text-foreground underline-offset-4 hover:underline">
              {{ t('kcs.panel.projects') }} →
            </NuxtLink>
          </p>
        </div>
      </template>
    </TableCard>
  </PanelPage>
</template>

<script setup lang="ts">
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowUpNarrowWide,
  Bookmark,
  Check,
  ChevronDown,
  FolderKanban,
  Info,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  X,
} from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import {
  CREATOR_TIERS,
  METRIC_KEYS,
  can,
  defaultSavedQuery,
  metricField,
  validateSavedQuery,
  type CreatorTier,
  type HealthGrade,
  type MetricFilter,
  type NumericMetricKey,
  type SavedQuery,
} from '@kcs/contract'

type SavedQueryRecord = { id: string; name: string; version: number; spec: SavedQuery }

const { t, te } = useI18n()
const { request } = useApi()
const { user } = useSession()
const { formatNumber } = useFormat()
const { label, help } = useMetrics()
const localePath = useLocalePath()
const route = useRoute()

const tierIds = CREATOR_TIERS.map((x) => x.id).filter((x) => x !== 'unknown') as CreatorTier[]
const healthIds: HealthGrade[] = ['excellent', 'normal', 'abnormal']
const metricKeys = METRIC_KEYS
const sortableKeys = ['followers', ...METRIC_KEYS.filter((k) => k !== 'followers')] as (NumericMetricKey | 'followers')[]

const savedQueries = ref<SavedQueryRecord[]>([])
const activeId = ref('')
const activeName = ref('')
const baseline = ref('')
const spec = reactive<SavedQuery>(defaultSavedQuery({ name: '' }))
const editorOpen = ref(false)
const errors = ref<string[]>([])
const notice = ref('')
const saving = ref(false)

const items = ref<any[]>([])
const search = ref('')
const picked = ref<string[]>([])
const confirming = ref(false)
const assigning = ref(false)
const loading = ref(true)
const projectName = ref('')

const projectId = computed(() => String(route.query.project || ''))
const canAssign = computed(() => Boolean(user.value && can(user.value.role, 'select.assign')))
const canWrite = computed(() => Boolean(user.value && can(user.value.role, 'select.write')))
const specJson = computed(() => JSON.stringify(spec))
const dirty = computed(() => specJson.value !== baseline.value)

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((r) => `${r.displayName ?? ''} ${r.creatorKey ?? ''} ${r.xhsId ?? ''}`.toLowerCase().includes(q))
})

function applySpec(next: SavedQuery) {
  Object.assign(spec, JSON.parse(JSON.stringify(next)))
}

function selectQuery(q: SavedQueryRecord) {
  activeId.value = q.id
  activeName.value = q.name
  applySpec({ ...q.spec, id: q.id, name: q.name, version: q.version })
  baseline.value = JSON.stringify(spec)
  errors.value = []
  notice.value = ''
}

function newQuery() {
  activeId.value = ''
  activeName.value = ''
  applySpec(defaultSavedQuery({ name: '' }))
  baseline.value = ''
  editorOpen.value = true
  notice.value = ''
}

function resetSpec() {
  const found = savedQueries.value.find((q) => q.id === activeId.value)
  if (found) selectQuery(found)
  else newQuery()
}

function toggleIn<T>(list: T[], value: T) {
  const i = list.indexOf(value)
  if (i >= 0) list.splice(i, 1)
  else list.push(value)
}

function toggleColumn(key: NumericMetricKey) {
  if (spec.columns.includes(key)) {
    if (spec.columns.length > 1) spec.columns.splice(spec.columns.indexOf(key), 1)
  } else spec.columns.push(key)
}

function sortBy(key: NumericMetricKey) {
  if (spec.sort.key === key) spec.sort.dir = spec.sort.dir === 'asc' ? 'desc' : 'asc'
  else {
    spec.sort.key = key
    spec.sort.dir = metricField(key).better === 'low' ? 'asc' : 'desc'
  }
}

function addFilter() {
  spec.filters.push({ key: 'cpe', op: 'lte', value: 3 })
}

function onOpChange(f: MetricFilter) {
  if (f.op === 'between' && !Array.isArray(f.value)) (f as any).value = [0, Number(f.value) || 0]
  else if (f.op !== 'between' && Array.isArray(f.value)) (f as any).value = f.value[1]
  else if (f.op === 'percentileGte' && (Number(f.value) < 0 || Number(f.value) > 100)) (f as any).value = 75
}

function unitHint(key: NumericMetricKey) {
  const unit = metricField(key).unit
  return unit === 'ratio' ? '0.03' : unit === 'cnyPerUnit' ? '3' : ''
}

let loadSeq = 0
async function run() {
  const mine = ++loadSeq
  loading.value = true
  try {
    const res = await request<any>('/api/select/queries/run', { method: 'POST', body: JSON.stringify(spec) })
    if (mine !== loadSeq) return
    items.value = res.items ?? res.rows ?? []
  } finally {
    if (mine === loadSeq) loading.value = false
  }
}

async function loadQueries() {
  try {
    const res = await request<any>('/api/select/queries')
    savedQueries.value = (res.items ?? res ?? []).map((q: any) => ({ id: q.id, name: q.name, version: q.version ?? 1, spec: q.spec ?? q }))
  } catch {
    savedQueries.value = []
  }
  if (!activeId.value && savedQueries.value[0]) selectQuery(savedQueries.value[0])
  else if (!activeId.value) {
    applySpec(defaultSavedQuery({ name: '' }))
    baseline.value = ''
  }
}

async function save(asNew: boolean) {
  errors.value = validateSavedQuery(spec)
  if (errors.value.length) {
    editorOpen.value = true
    return
  }
  saving.value = true
  notice.value = ''
  try {
    const payload = { name: spec.name, spec: { ...spec, id: undefined } }
    const res =
      activeId.value && !asNew
        ? await request<any>(`/api/select/queries/${activeId.value}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await request<any>('/api/select/queries', { method: 'POST', body: JSON.stringify(payload) })
    await loadQueries()
    const saved = savedQueries.value.find((q) => q.id === (res.id ?? activeId.value))
    if (saved) selectQuery(saved)
    notice.value = t('kcs.query.saved')
  } catch (e: any) {
    errors.value = e?.data?.errors ?? [String(e?.message ?? e)]
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!activeId.value || !confirm(t('kcs.query.confirmDelete'))) return
  await request(`/api/select/queries/${activeId.value}`, { method: 'DELETE' })
  activeId.value = ''
  await loadQueries()
  notice.value = t('kcs.query.deleted')
}

async function loadProject() {
  if (!projectId.value) return
  try {
    const project = await request<any>(`/api/select/projects/${projectId.value}`)
    projectName.value = project?.name ?? ''
  } catch {
    projectName.value = ''
  }
}

function toggle(id: string) {
  picked.value = picked.value.includes(id) ? picked.value.filter((x) => x !== id) : [...picked.value, id]
}

async function assign() {
  if (!projectId.value || !picked.value.length) return
  assigning.value = true
  try {
    await request(`/api/select/projects/${projectId.value}/assignments`, {
      method: 'POST',
      body: JSON.stringify({ creatorIds: picked.value }),
    })
    confirming.value = false
    await navigateTo(localePath(`/projects/${projectId.value}`))
  } finally {
    assigning.value = false
  }
}

onMounted(async () => {
  await loadQueries()
  await run()
  loadProject()
})
const debouncedRun = useDebounceFn(run, 300)
watch(specJson, () => debouncedRun())
watch(picked, () => {
  if (!picked.value.length) confirming.value = false
})
</script>
