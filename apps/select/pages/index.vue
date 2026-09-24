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
    <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="query-bar" @click.capture="markDiscrete" @change.capture="markDiscrete">
      <div class="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
        <Bookmark class="size-4 text-primary" aria-hidden="true" />
        <span class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{{ t('kcs.query.title') }}</span>
        <div class="flex flex-wrap items-center gap-1.5" role="tablist" :aria-label="t('kcs.query.title')">
          <template v-for="shelf in shelves" :key="shelf.id">
            <span
              v-if="shelf.items.length"
              class="ml-1 text-[11px] font-medium text-muted-foreground first:ml-0"
              :data-testid="`query-shelf-${shelf.id}`"
            >{{ t(`kcs.query.${shelf.id}`) }}</span>
            <button
              v-for="q in shelf.items"
              :key="q.id"
              type="button"
              role="tab"
              class="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium transition-colors"
              :class="activeId === q.id && !dirty ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted'"
              :aria-selected="activeId === q.id && !dirty"
              :title="q.visibility === 'private' ? t('kcs.query.privateTag') : q.ownerName ? t('kcs.query.byOwner', { name: q.ownerName }) : undefined"
              :data-testid="`query-tab-${q.id}`"
              :data-visibility="q.visibility"
              @click="selectQuery(q)"
            >
              <Lock v-if="q.visibility === 'private'" class="size-3 opacity-70" :aria-label="t('kcs.query.privateTag')" />
              {{ q.name }}
              <span class="text-[10px] opacity-70">{{ t('kcs.query.version', { n: q.version }) }}</span>
            </button>
          </template>
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
      <div class="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:flex-wrap lg:items-end">
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

        <div class="min-w-0 lg:min-w-[14rem] lg:flex-1">
          <Label for="pool-search" class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.creators.search') }}</Label>
          <div class="relative">
            <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="pool-search" v-model="search" data-testid="pool-search" class="h-9 pl-8" :class="search.trim() ? 'pr-24' : ''" :placeholder="t('kcs.creators.search')" />
            <Button
              v-if="search.trim()"
              variant="ghost"
              size="sm"
              class="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-[11px]"
              :title="t('kcs.query.savedSearchHint')"
              data-testid="pool-search-save"
              @click="keepSearch"
            >
              <BookmarkPlus class="size-3.5" />
              {{ t('kcs.query.saveSearch') }}
            </Button>
          </div>
          <span
            v-if="spec.search"
            class="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
            data-testid="query-saved-search"
          >
            <span class="truncate">{{ t('kcs.query.savedSearchChip', { q: spec.search }) }}</span>
            <button type="button" class="rounded hover:bg-primary/15" :aria-label="t('kcs.query.clearSavedSearch')" @click="spec.search = ''">
              <X class="size-3" />
            </button>
          </span>
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
              :aria-label="sortDirLabel"
              @click="spec.sort.dir = spec.sort.dir === 'asc' ? 'desc' : 'asc'"
            >
              <ArrowUpNarrowWide v-if="spec.sort.dir === 'asc'" class="size-4" aria-hidden="true" />
              <ArrowDownWideNarrow v-else class="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <fieldset data-testid="service-fee" class="min-w-0">
          <legend class="mb-1.5 text-xs font-medium text-muted-foreground" :title="t('kcs.query.serviceFeeHint')">{{ t('kcs.query.serviceFee') }}</legend>
          <div class="inline-flex rounded-md border border-border bg-muted/40 p-0.5" role="group" :title="t('kcs.query.serviceFeeHint')">
            <button
              v-for="rate in SERVICE_FEE_RATES"
              :key="rate"
              type="button"
              class="h-8 rounded-[6px] px-3 text-xs font-medium tabular-nums transition-colors"
              :class="spec.serviceFee === rate ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
              :aria-pressed="spec.serviceFee === rate"
              :data-testid="`service-fee-${rate * 100}`"
              @click="spec.serviceFee = rate"
            >
              {{ rate ? t('kcs.query.serviceFeeRate', { n: rate * 100 }) : t('kcs.query.serviceFeeNone') }}
            </button>
          </div>
        </fieldset>
      </div>

      <!-- 方案编辑器 -->
      <div v-if="editorOpen" class="grid gap-6 border-t border-border/60 bg-muted/20 px-4 py-5 sm:px-5 lg:grid-cols-[1fr_1fr_minmax(16rem,0.8fr)]" data-testid="query-editor">
        <section class="flex flex-col gap-3">
          <h3 class="text-sm font-semibold">{{ t('kcs.query.scope') }}</h3>
          <fieldset v-if="categoryOptions.length" class="min-w-0" data-testid="query-categories">
            <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.query.categories') }}</legend>
            <div class="flex flex-wrap gap-1.5">
              <button
                type="button"
                class="h-7 rounded-md border px-2 text-[11px] font-medium transition-colors"
                :class="!spec.categories.length ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'"
                :aria-pressed="!spec.categories.length"
                @click="spec.categories = []"
              >
                {{ t('kcs.query.anyCategory') }}
              </button>
              <button
                v-for="c in categoryOptions"
                :key="c.slug"
                type="button"
                class="h-7 rounded-md border px-2 text-[11px] font-medium transition-colors"
                :class="spec.categories.includes(c.slug) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'"
                :aria-pressed="spec.categories.includes(c.slug)"
                :data-testid="`query-category-${c.slug}`"
                @click="toggleIn(spec.categories, c.slug)"
              >
                {{ c.name[locale] ?? c.slug }}
              </button>
            </div>
          </fieldset>
          <div class="flex flex-wrap items-end gap-3">
            <fieldset class="min-w-0" data-testid="query-collab">
              <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.query.collab') }}</legend>
              <div class="inline-flex rounded-md border border-border bg-muted/40 p-0.5" role="group">
                <button
                  v-for="opt in collabOptions"
                  :key="String(opt.value)"
                  type="button"
                  class="h-7 rounded-[6px] px-2.5 text-[11px] font-medium transition-colors"
                  :class="spec.hasCollaborated === opt.value ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
                  :aria-pressed="spec.hasCollaborated === opt.value"
                  :data-testid="`query-collab-${opt.id}`"
                  @click="spec.hasCollaborated = opt.value"
                >
                  {{ t(`kcs.query.${opt.label}`) }}
                </button>
              </div>
            </fieldset>
            <fieldset class="min-w-0" data-testid="query-collab-count">
              <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.query.collabCount') }}</legend>
              <div class="flex items-center gap-1">
                <Input
                  :model-value="spec.collabCountMin ?? ''"
                  type="number"
                  min="0"
                  step="1"
                  class="h-7 w-16 px-2 text-xs tabular-nums"
                  :placeholder="t('kcs.query.collabCountMin')"
                  :aria-label="t('kcs.query.collabCountMin')"
                  data-testid="query-collab-min"
                  @update:model-value="(v) => (spec.collabCountMin = countValue(v))"
                />
                <span class="text-muted-foreground/60">–</span>
                <Input
                  :model-value="spec.collabCountMax ?? ''"
                  type="number"
                  min="0"
                  step="1"
                  class="h-7 w-16 px-2 text-xs tabular-nums"
                  :placeholder="t('kcs.query.collabCountMax')"
                  :aria-label="t('kcs.query.collabCountMax')"
                  data-testid="query-collab-max"
                  @update:model-value="(v) => (spec.collabCountMax = countValue(v))"
                />
              </div>
            </fieldset>
          </div>

          <div class="mt-2 flex items-center justify-between">
            <h3 class="text-sm font-semibold">{{ t('kcs.query.filters') }}</h3>
            <Button variant="ghost" size="sm" class="h-7 text-xs" data-testid="query-add-filter" @click="addFilter">
              <Plus class="size-3.5" />
              {{ t('kcs.query.addFilter') }}
            </Button>
          </div>
          <p v-if="!spec.filters.length" class="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
            {{ t('kcs.query.noFilters') }}
          </p>
          <p v-else-if="spec.groups.length" class="-mb-1 text-[11px] text-muted-foreground">{{ t('kcs.query.filtersAll') }}</p>
          <FilterRow
            v-for="(f, i) in spec.filters"
            :key="`f-${i}`"
            :filter="f"
            :reference="referenceFor(f.key)"
            :testid="`query-filter-${i}`"
            @remove="spec.filters.splice(i, 1)"
          />

          <div
            v-for="(g, gi) in spec.groups"
            :key="`g-${gi}`"
            class="flex flex-col gap-2 rounded-md border px-2.5 py-2"
            :class="g.mode === 'exclude' ? 'border-destructive/30 bg-destructive/5' : 'border-primary/25 bg-primary/5'"
            :data-testid="`query-group-${gi}`"
            :data-mode="g.mode"
          >
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold" :class="g.mode === 'exclude' ? 'text-destructive' : 'text-primary'">
                {{ g.mode === 'exclude' ? t('kcs.query.groupExclude') : t('kcs.query.groupAny') }}
              </span>
              <span class="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                {{ g.mode === 'exclude' ? t('kcs.query.groupExcludeHint') : t('kcs.query.groupAnyHint') }}
              </span>
              <Button variant="ghost" size="sm" class="h-6 px-1.5 text-[11px]" :data-testid="`query-group-${gi}-add`" @click="g.filters.push({ key: 'cpe', op: 'lte', value: 3 })">
                <Plus class="size-3" />
                {{ t('kcs.query.addFilter') }}
              </Button>
              <Button variant="ghost" size="icon" class="size-6 text-muted-foreground" :aria-label="t('kcs.query.removeGroup')" @click="spec.groups.splice(gi, 1)">
                <X class="size-3.5" />
              </Button>
            </div>
            <p v-if="!g.filters.length" class="text-[11px] text-muted-foreground">{{ t('kcs.query.emptyGroup') }}</p>
            <FilterRow
              v-for="(f, i) in g.filters"
              :key="`g-${gi}-${i}`"
              :filter="f"
              :reference="referenceFor(f.key)"
              :testid="`query-group-${gi}-filter-${i}`"
              @remove="g.filters.splice(i, 1)"
            />
          </div>
          <div v-if="spec.groups.length < SAVED_QUERY_LIMITS.groups" class="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" class="h-7 text-[11px]" data-testid="query-add-group-any" @click="addGroup('any')">
              <Plus class="size-3" />
              {{ t('kcs.query.addGroupAny') }}
            </Button>
            <Button variant="outline" size="sm" class="h-7 text-[11px]" data-testid="query-add-group-exclude" @click="addGroup('exclude')">
              <Plus class="size-3" />
              {{ t('kcs.query.addGroupExclude') }}
            </Button>
          </div>
        </section>

        <section class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">{{ t('kcs.query.highlights') }}</h3>
            <div class="flex items-center gap-1">
              <Button v-if="!hasHealthGate" variant="ghost" size="sm" class="h-7 text-xs" data-testid="query-add-health-gate" @click="spec.highlights.unshift({ ...HEALTH_GATE })">
                <Plus class="size-3.5" />
                {{ t('kcs.query.addHealthGate') }}
              </Button>
              <Button variant="ghost" size="sm" class="h-7 text-xs" data-testid="query-add-highlight" @click="spec.highlights.push({ key: 'cpe', op: 'percentileGte', value: 75, tone: 'good' })">
                <Plus class="size-3.5" />
                {{ t('kcs.query.addFilter') }}
              </Button>
            </div>
          </div>
          <template v-for="(h, i) in spec.highlights" :key="i">
            <div v-if="isHealthGate(h)" class="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs" data-testid="query-health-gate">
              <span class="size-2 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
              <span class="flex-1">{{ t('kcs.query.healthGate') }}</span>
              <Button variant="ghost" size="icon" class="size-7 text-muted-foreground" :aria-label="t('kcs.query.removeFilter')" @click="spec.highlights.splice(i, 1)">
                <X class="size-3.5" />
              </Button>
            </div>
            <div v-else class="grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-1.5" :data-testid="`query-highlight-${i}`">
              <select v-model="h.key" class="border-input h-8 min-w-0 rounded-md border bg-background px-2 text-xs shadow-xs outline-none" :aria-label="t('kcs.query.metricPick')">
                <option v-for="key in metricKeys" :key="key" :value="key">{{ label(key) }}</option>
              </select>
              <select v-model="h.op" class="border-input h-8 rounded-md border bg-background px-2 text-xs shadow-xs outline-none" :aria-label="t('kcs.query.opPick')" @change="onHighlightOpChange(h)">
                <option value="gte">{{ t('kcs.query.op.gte') }}</option>
                <option value="lte">{{ t('kcs.query.op.lte') }}</option>
                <option value="percentileGte">{{ t('kcs.query.op.percentileGte') }}</option>
                <option value="percentileLte">{{ t('kcs.query.op.percentileLte') }}</option>
              </select>
              <Input v-model.number="h.value" type="number" step="any" class="h-8 min-w-0 px-2 text-xs tabular-nums" :aria-label="t('kcs.query.value')" />
              <select v-model="h.tone" class="border-input h-8 rounded-md border bg-background px-2 text-xs shadow-xs outline-none" :aria-label="t('kcs.query.tonePick')">
                <option value="good">{{ t('kcs.query.tone.good') }}</option>
                <option value="warn">{{ t('kcs.query.tone.warn') }}</option>
                <option value="bad">{{ t('kcs.query.tone.bad') }}</option>
              </select>
              <Button variant="ghost" size="icon" class="size-8 text-muted-foreground" :aria-label="t('kcs.query.removeFilter')" @click="spec.highlights.splice(i, 1)">
                <X class="size-3.5" />
              </Button>
              <label class="col-span-full flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {{ t('kcs.query.onlySources') }}
                <select
                  :value="h.sources?.[0] ?? ''"
                  class="border-input h-7 rounded-md border bg-background px-1.5 text-[11px] shadow-xs outline-none"
                  :data-testid="`query-highlight-source-${i}`"
                  @change="setHighlightSource(h, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">{{ t('kcs.query.allSources') }}</option>
                  <option v-for="source in SOURCE_IDS" :key="source" :value="source">{{ t(`kcs.source.${source}`) }}</option>
                </select>
              </label>
              <ReferenceChips v-if="h.op === 'gte' || h.op === 'lte'" class="col-span-full" :line="referenceFor(h.key, h.sources)" :metric-key="h.key" @pick="(v) => (h.value = v)" />
            </div>
          </template>

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
          <fieldset class="min-w-0" data-testid="query-visibility">
            <legend class="mb-1.5 text-xs font-medium text-muted-foreground">{{ t('kcs.query.visibility') }}</legend>
            <div class="inline-flex rounded-md border border-border bg-muted/40 p-0.5" role="group" :title="canChangeVisibility ? undefined : t('kcs.query.visibilityOwnerOnly')">
              <button
                v-for="v in QUERY_VISIBILITIES"
                :key="v"
                type="button"
                class="inline-flex h-7 items-center gap-1 rounded-[6px] px-2.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                :class="spec.visibility === v ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
                :aria-pressed="spec.visibility === v"
                :disabled="!canChangeVisibility"
                :data-testid="`query-visibility-${v}`"
                @click="spec.visibility = v"
              >
                <Lock v-if="v === 'private'" class="size-3" aria-hidden="true" />
                <Users v-else class="size-3" aria-hidden="true" />
                {{ v === 'private' ? t('kcs.query.visibilityPrivate') : t('kcs.query.visibilityTeam') }}
              </button>
            </div>
            <p v-if="!canChangeVisibility" class="mt-1 text-[11px] text-muted-foreground">{{ t('kcs.query.visibilityOwnerOnly') }}</p>
          </fieldset>
          <div>
            <Label for="query-search" class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('kcs.query.savedSearch') }}</Label>
            <Input id="query-search" v-model.trim="spec.search" data-testid="query-search" class="h-8 text-xs" :maxlength="SAVED_QUERY_LIMITS.search" :placeholder="t('kcs.creators.search')" />
            <p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">{{ t('kcs.query.savedSearchHint') }}</p>
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
          <p v-if="notice" class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="query-notice">
            {{ notice }}
            <Button v-if="undoId" variant="link" size="sm" class="h-auto p-0 text-xs" data-testid="query-undo-delete" @click="restore(undoId)">
              {{ t('kcs.query.deletedUndo') }}
            </Button>
          </p>
          <QueryRevisions v-if="activeId" :query-id="activeId" :current-version="activeVersion" @use="useRevision" />
          <p class="text-xs leading-relaxed text-muted-foreground">{{ t('kcs.tier.hint') }}</p>
        </section>
      </div>
    </Card>

    <!-- 达人表：列由方案决定 -->
    <TableCard :title="t('kcs.panel.pool')" dense>
      <template #meta>
        <span class="tabular-nums" data-testid="pool-count">{{ t('kcs.query.matched', { n: formatNumber(total) }) }}</span>
      </template>
      <template v-if="spec.highlights.length" #actions>
        <!-- 高亮图例：方案里的阈值 → 颜色，新同事不用猜 -->
        <ul class="hidden flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground md:flex" data-testid="pool-legend">
          <li v-for="(h, i) in spec.highlights" :key="i" class="inline-flex items-center gap-1.5">
            <span class="size-2 rounded-full" :class="toneDot(h.tone)" aria-hidden="true" />
            {{ legendText(h) }}
          </li>
          <li class="text-muted-foreground/70">· {{ t('kcs.band.legend') }}</li>
        </ul>
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
          :class="canPick ? 'cursor-pointer active:bg-muted/60' : ''"
          :data-state="picked.includes(row.id) ? 'selected' : undefined"
          @click="canPick && toggle(row.id)"
        >
          <input
            v-if="canPick"
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
              <span v-if="row.stale" class="ml-auto shrink-0 rounded border border-border px-1.5 text-[10px] text-muted-foreground" :title="t('kcs.band.stale')" data-testid="row-stale">{{ t('kcs.band.staleShort') }}</span>
              <HealthBadge :health="row.metrics?.health" :low-active="row.metrics?.lowActive" />
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-1.5">
              <TierBadge :tier="row.tier" />
              <SourceBadge :source="row.source" />
            </div>
            <dl class="mt-2.5 grid grid-cols-3 gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
              <div v-for="key in mobileColumns" :key="key" class="min-w-0">
                <dt class="truncate text-muted-foreground">{{ label(key) }}</dt>
                <dd class="font-semibold">
                  <MetricValue :metric-key="key" :value="row.metrics?.[key]" :rank="row.percentiles?.[key]" :cohort="row.cohort" :stale="row.stale" compact />
                </dd>
              </div>
            </dl>
          </div>
        </li>
      </ul>

      <div class="hidden md:block">
        <Table data-testid="table-pool">
          <TableHeader @click.capture="markDiscrete">
            <TableRow class="hover:bg-transparent">
              <TableHead v-if="canPick" class="w-10"><span class="sr-only">{{ t('kcs.panel.assign') }}</span></TableHead>
              <TableHead class="min-w-48">{{ t('kcs.creators.cols.creator') }}</TableHead>
              <TableHead class="w-20">{{ t('kcs.tier.label') }}</TableHead>
              <TableHead class="w-20">{{ t('kcs.health.label') }}</TableHead>
              <TableHead
                v-for="key in spec.columns"
                :key="key"
                class="text-right"
                :class="spec.sort.key === key ? 'text-foreground' : ''"
                :title="help(key)"
                :aria-sort="spec.sort.key === key ? (spec.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined"
              >
                <button type="button" class="inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground" :aria-label="t('kcs.query.sortBy', { metric: label(key) })" @click="sortBy(key)">
                  {{ label(key) }}
                  <ArrowUpNarrowWide v-if="spec.sort.key === key && spec.sort.dir === 'asc'" class="size-3" aria-hidden="true" />
                  <ArrowDownWideNarrow v-else-if="spec.sort.key === key" class="size-3" aria-hidden="true" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="loading && !visible.length">
              <!-- 占满一屏（到 1080 高）：结果回来前表尾已在折线下，换成真实行时不把它推走 -->
              <TableRow v-for="i in 12" :key="`sk-${i}`" class="hover:bg-transparent">
                <TableCell v-if="canPick"><Skeleton class="size-4" /></TableCell>
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
              :class="canPick ? 'cursor-pointer' : ''"
              @click="canPick && toggle(row.id)"
            >
              <TableCell v-if="canPick" @click.stop>
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
                        :class="toneDot(flag.tone)"
                        :data-flag="flag.key"
                        :data-tone="flag.tone"
                        :title="`${flagLabel(flag.key)} · ${t(`kcs.query.tone.${flag.tone}`)}`"
                      />
                      <span v-if="row.stale" class="rounded border border-border px-1.5 text-[10px] text-muted-foreground" :title="t('kcs.band.stale')" data-testid="row-stale">{{ t('kcs.band.staleShort') }}</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <SourceBadge :source="row.source" class="h-5 border-0 bg-transparent px-0" />
                      <span v-if="row.regions?.length" class="truncate">· {{ row.regions.slice(0, 2).join(' · ') }}</span>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell><TierBadge :tier="row.tier" /></TableCell>
              <TableCell><HealthBadge :health="row.metrics?.health" :low-active="row.metrics?.lowActive" /></TableCell>
              <TableCell v-for="key in spec.columns" :key="key" class="text-right text-[13px]">
                <MetricValue :metric-key="key" :value="row.metrics?.[key]" :rank="row.percentiles?.[key]" :cohort="row.cohort" :stale="row.stale" compact />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <EmptyState v-if="!loading && !visible.length" :title="t('kcs.query.noResult')" :body="t('kcs.query.lead')">
        <Button variant="outline" size="sm" @click="resetSpec">{{ t('kcs.query.reset') }}</Button>
      </EmptyState>

      <div v-if="pages > 1" class="border-t border-border/60 px-4 py-3 sm:px-5">
        <ListPager
          v-model:page="page"
          :pages="pages"
          :info="t('kcs.query.pageInfo', { page, pages, total: formatNumber(total) })"
          :prev-label="t('kcs.query.prev')"
          :next-label="t('kcs.query.next')"
          testid="pool-pager"
        />
      </div>

      <template v-if="canAssign || canWrite" #footer>
        <div class="flex flex-wrap items-center gap-3">
          <template v-if="projectId && canAssign">
            <Button data-testid="btn-assign" type="button" :disabled="!picked.length" @click="confirming = true">
              <UserPlus class="size-4" />
              {{ t('kcs.panel.assign') }}
            </Button>
            <Button v-if="confirming" data-testid="btn-assign-confirm" type="button" variant="secondary" :disabled="assigning" @click="assign">
              <Check class="size-4" />
              {{ t('kcs.panel.confirmAssign') }}
            </Button>
          </template>
          <Button
            v-if="canWrite"
            data-testid="btn-shortlist-add"
            type="button"
            :variant="projectId ? 'outline' : 'default'"
            :disabled="!picked.length || shortlisting"
            @click="addToShortlist"
          >
            <ListPlus class="size-4" />
            {{ shortlisting ? t('kcs.console.shortlist.adding') : t('kcs.console.shortlist.add') }}
          </Button>
          <span class="text-sm tabular-nums text-muted-foreground">{{ t('kcs.panel.picked', { n: picked.length }) }}</span>
          <p v-if="shortlistNotice" class="flex flex-wrap items-center gap-2 text-sm text-foreground" role="status" data-testid="shortlist-notice">
            <Check class="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            {{ shortlistNotice }}
            <NuxtLink :to="localePath('/shortlist')" class="font-medium underline-offset-4 hover:underline">
              {{ t('kcs.console.shortlist.view') }} →
            </NuxtLink>
          </p>
          <p v-if="!projectId && canAssign" class="flex w-full flex-wrap items-center gap-1 text-sm text-muted-foreground">
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
  BookmarkPlus,
  Check,
  ChevronDown,
  FolderKanban,
  Info,
  ListPlus,
  Lock,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import {
  API,
  apiPath,
  CREATOR_TIERS,
  HEALTH_GATE,
  HEALTH_GRADES,
  SOURCE_IDS,
  isHealthGate,
  SERVICE_FEE_RATES,
  VISIBLE_METRIC_KEYS,
  PAGE_SIZE_DEFAULT,
  can,
  pageCount,
  defaultSavedQuery,
  metricField,
  validateSavedQuery,
  QUERY_VISIBILITIES,
  SAVED_QUERY_LIMITS,
  type CreatorTier,
  type FilterGroup,
  type HealthGrade,
  type Highlight,
  type HighlightTone,
  type MetricHighlight,
  type NumericMetricKey,
  type SavedQuery,
  type SavedQueryRecord,
  type SavedQueryRevision,
  type SourceId,
} from '@kcs/contract'
import FilterRow from '~/components/FilterRow.vue'
import QueryRevisions from '~/components/QueryRevisions.vue'
import ReferenceChips, { type ReferenceLine } from '~/components/ReferenceChips.vue'

type CategoryOption = { slug: string; name: Record<string, string>; group: string | null }

const SPEC_FIELDS = Object.keys(defaultSavedQuery()) as Array<keyof SavedQuery>

/** 列表记录里除了方案本身还有归属、修改人等信息；编辑器和提交只带方案字段。 */
function specOf(value: Partial<SavedQuery> & Record<string, unknown>): SavedQuery {
  const base = defaultSavedQuery()
  const picked = Object.fromEntries(SPEC_FIELDS.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]))
  return { ...base, ...picked } as SavedQuery
}

const { t, te, locale } = useI18n()
const { request, errorText } = useApi()
const { user } = useSession()
const { formatNumber } = useFormat()
const { label, help, format } = useMetrics()
const localePath = useLocalePath()
const route = useRoute()

const tierIds = CREATOR_TIERS.map((x) => x.id).filter((x) => x !== 'unknown') as CreatorTier[]
const healthIds: HealthGrade[] = [...HEALTH_GRADES]
const metricKeys = VISIBLE_METRIC_KEYS
const sortableKeys = ['followers', ...VISIBLE_METRIC_KEYS.filter((k) => k !== 'followers')] as (NumericMetricKey | 'followers')[]

const savedQueries = ref<SavedQueryRecord[]>([])
const categoryOptions = ref<CategoryOption[]>([])
const collabOptions = [
  { id: 'any', value: null, label: 'collabAny' },
  { id: 'yes', value: true, label: 'collabYes' },
  { id: 'no', value: false, label: 'collabNo' },
] as const
const undoId = ref('')
const activeId = ref('')
const activeName = ref('')
const baseline = ref('')
const spec = reactive<SavedQuery>(defaultSavedQuery({ name: '' }))
const editorOpen = ref(false)
const errors = ref<string[]>([])
const notice = ref('')
const saving = ref(false)

const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const picked = ref<string[]>([])
const confirming = ref(false)
const assigning = ref(false)
const loading = ref(true)
const projectName = ref('')

const projectId = computed(() => String(route.query.project || ''))
const canAssign = computed(() => Boolean(user.value && can(user.value.role, 'select.assign')))
const canWrite = computed(() => Boolean(user.value && can(user.value.role, 'select.write')))
const canPick = computed(() => canAssign.value || canWrite.value)
const shortlisting = ref(false)
const shortlistNotice = ref('')
const sortDirLabel = computed(() => {
  const [dir, next] = spec.sort.dir === 'asc' ? [t('kcs.query.asc'), t('kcs.query.desc')] : [t('kcs.query.desc'), t('kcs.query.asc')]
  return t('kcs.query.sortDirToggle', { dir, next })
})
const specJson = computed(() => JSON.stringify(spec))
const activeRecord = computed(() => savedQueries.value.find((q) => q.id === activeId.value) ?? null)
const activeVersion = computed(() => activeRecord.value?.version ?? 1)
/** 谁能看到只有建方案的人能改；新方案随便选。 */
const canChangeVisibility = computed(() => !activeId.value || Boolean(activeRecord.value?.mine))
const shelves = computed(() => [
  { id: 'mine' as const, items: savedQueries.value.filter((q) => q.mine) },
  { id: 'team' as const, items: savedQueries.value.filter((q) => !q.mine) },
])
const dirty = computed(() => specJson.value !== baseline.value)

/** 手机卡片只放三格：排序键优先，其余按方案列顺序补。 */
const mobileColumns = computed<NumericMetricKey[]>(() => {
  const first = spec.sort.key !== 'followers' ? [spec.sort.key] : []
  return [...new Set([...first, ...spec.columns])].slice(0, 3)
})

/** 搜索、筛选、排序、分页都在服务端：这里就是当前这一页。已勾选的人跨页保留。 */
const visible = computed(() => items.value)
const pages = computed(() => pageCount(total.value, PAGE_SIZE_DEFAULT))

function applySpec(next: SavedQuery) {
  Object.assign(spec, JSON.parse(JSON.stringify(next)))
}

function selectQuery(q: SavedQueryRecord) {
  activeId.value = q.id
  activeName.value = q.name
  undoId.value = ''
  applySpec({ ...specOf(q), id: q.id, name: q.name, version: q.version })
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

function addGroup(mode: FilterGroup['mode']) {
  spec.groups.push({ mode, filters: [{ key: 'cpe', op: mode === 'exclude' ? 'gte' : 'lte', value: 3 }] })
}

function countValue(raw: string | number): number | null {
  if (raw === '' || raw == null) return null
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) ? Math.max(0, n) : null
}

/** 把搜索框里的词存进方案：之后每次打开这个方案都带上。 */
function keepSearch() {
  spec.search = search.value.trim().slice(0, SAVED_QUERY_LIMITS.search)
  search.value = ''
}

function useRevision(revision: SavedQueryRevision) {
  const visibility = canChangeVisibility.value ? revision.visibility : spec.visibility
  applySpec({ ...specOf(revision.spec), id: activeId.value, version: activeVersion.value, name: revision.name, visibility })
  editorOpen.value = true
  notice.value = t('kcs.query.revisionLoaded', { n: revision.version })
}


const hasHealthGate = computed(() => spec.highlights.some(isHealthGate))

function toneDot(tone: HighlightTone) {
  return tone === 'good' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-destructive'
}

function flagLabel(key: NumericMetricKey | 'health') {
  return key === 'health' ? t('kcs.health.label') : label(key)
}

function legendText(h: Highlight) {
  if (isHealthGate(h)) return t('kcs.query.healthGate')
  const scope = h.sources?.length ? ` · ${h.sources.map((s) => t(`kcs.source.${s}`)).join('/')}` : ''
  if (h.op === 'percentileGte' || h.op === 'percentileLte') return `${label(h.key)} · ${t(`kcs.query.opLegend.${h.op}`, { n: h.value })}${scope}`
  return `${label(h.key)} ${h.op === 'gte' ? '≥' : '≤'} ${format(h.key, h.value)}${scope}`
}

function onHighlightOpChange(h: MetricHighlight) {
  if ((h.op === 'percentileGte' || h.op === 'percentileLte') && (h.value < 0 || h.value > 100)) h.value = h.op === 'percentileGte' ? 75 : 25
}

function setHighlightSource(h: MetricHighlight, value: string) {
  if (value) h.sources = [value as SourceId]
  else delete h.sources
}

/** 本库同组 25/50/75 分位：只取方案选中的数据源和量级里人数最多的一组作参考。 */
const referenceLines = ref<ReferenceLine[]>([])
function referenceFor(key: NumericMetricKey, sources?: SourceId[]): ReferenceLine | null {
  const wantSources = sources?.length ? sources : spec.sources
  const candidates = referenceLines.value.filter((line) =>
    line.key === key
    && (!wantSources.length || (line.source != null && wantSources.includes(line.source as SourceId)))
    && (!spec.tiers.length || spec.tiers.includes(line.tier as CreatorTier)))
  return candidates.sort((a, b) => b.n - a.n)[0] ?? null
}

async function loadReferenceLines() {
  try {
    referenceLines.value = (await request<any>(API.poolReferenceLines.path)).items ?? []
  } catch {
    referenceLines.value = []
  }
}

/** 上一页 / 下一页走服务端给的游标（不按偏移数行，翻得再深也一样快）；跳页仍按页码。 */
const cursors = { page: 0, next: null as string | null, prev: null as string | null }

let loadSeq = 0
let lastRunKey = ''
const runKey = () => JSON.stringify([page.value, search.value.trim(), specJson.value])
async function run() {
  const mine = ++loadSeq
  lastRunKey = runKey()
  loading.value = true
  try {
    // 新建还没起名的方案也要能先看结果；名字只在保存时必填。
    const body = { ...spec, name: spec.name.trim() || t('kcs.query.unsaved') }
    const params = new URLSearchParams({ pageSize: String(PAGE_SIZE_DEFAULT) })
    if (search.value.trim()) params.set('q', search.value.trim())
    const step = page.value - cursors.page
    const cursor = step === 1 ? cursors.next : step === -1 ? cursors.prev : null
    let res: any
    try {
      res = await request<any>(apiPath(API.queryRun, {}, new URLSearchParams([...params, cursor ? ['cursor', cursor] : ['page', String(page.value)]])), { method: 'POST', body: JSON.stringify(body) })
    } catch (e) {
      if (!cursor) throw e
      res = await request<any>(apiPath(API.queryRun, {}, new URLSearchParams([...params, ['page', String(page.value)]])), { method: 'POST', body: JSON.stringify(body) })
    }
    if (mine !== loadSeq) return
    items.value = res.items ?? []
    total.value = res.total ?? items.value.length
    Object.assign(cursors, { page: res.page ?? page.value, next: res.nextCursor ?? null, prev: res.prevCursor ?? null })
    if (page.value > pages.value) page.value = pages.value
  } catch (e) {
    if (mine === loadSeq) lastRunKey = ''
    throw e
  } finally {
    if (mine === loadSeq) loading.value = false
  }
}

async function loadQueries() {
  try {
    const res = await request<{ items: SavedQueryRecord[] }>(API.queries.path)
    savedQueries.value = res.items ?? []
  } catch {
    savedQueries.value = []
  }
  if (!activeId.value && savedQueries.value[0]) selectQuery(savedQueries.value[0])
  else if (!activeId.value) {
    applySpec(defaultSavedQuery({ name: '' }))
    baseline.value = ''
  }
}

async function loadCategories() {
  try {
    categoryOptions.value = (await request<{ items: CategoryOption[] }>(API.poolCategories.path)).items ?? []
  } catch {
    categoryOptions.value = []
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
  undoId.value = ''
  const patching = Boolean(activeId.value && !asNew)
  try {
    // 改已有方案时带上版本号：别人刚保存过就会被拦下（409），不会悄悄覆盖。
    const payload = { ...specOf(spec), id: undefined, version: patching ? activeVersion.value : undefined }
    const res = patching
      ? await request<SavedQueryRecord>(apiPath(API.queryPatch, { id: activeId.value }), { method: 'PATCH', body: JSON.stringify(payload) })
      : await request<SavedQueryRecord>(API.queryCreate.path, { method: 'POST', body: JSON.stringify(payload) })
    await loadQueries()
    const saved = savedQueries.value.find((q) => q.id === (res.id ?? activeId.value))
    if (saved) selectQuery(saved)
    notice.value = t('kcs.query.saved')
  } catch (e: any) {
    if (e?.status === 409 && e?.data?.current) {
      await loadQueries()
      const latest = savedQueries.value.find((q) => q.id === activeId.value)
      if (latest) selectQuery(latest)
      errors.value = []
      notice.value = t('kcs.query.conflict', { n: e.data.current.version })
      editorOpen.value = true
    } else {
      errors.value = e?.data?.errors ?? [errorText(e)]
    }
  } finally {
    saving.value = false
  }
}

/** 删除只是收起来：列表里看不到，修改记录都在，可以撤销。 */
async function remove() {
  if (!activeId.value || !confirm(t('kcs.query.confirmDelete'))) return
  const id = activeId.value
  await request(apiPath(API.queryDelete, { id }), { method: 'DELETE' })
  activeId.value = ''
  await loadQueries()
  notice.value = t('kcs.query.deleted')
  undoId.value = id
}

async function restore(id: string) {
  await request(apiPath(API.queryRestore, { id }), { method: 'POST' })
  await loadQueries()
  const back = savedQueries.value.find((q) => q.id === id)
  if (back) selectQuery(back)
  notice.value = t('kcs.query.restored')
  undoId.value = ''
}

async function loadProject() {
  if (!projectId.value) return
  try {
    const project = await request<any>(apiPath(API.projectGet, { id: projectId.value }))
    projectName.value = project?.name ?? ''
  } catch {
    projectName.value = ''
  }
}

function toggle(id: string) {
  picked.value = picked.value.includes(id) ? picked.value.filter((x) => x !== id) : [...picked.value, id]
}

/** One POST per creator; someone taken down since the list loaded is skipped (404), not an error. */
async function addToShortlist() {
  if (!picked.value.length) return
  shortlisting.value = true
  shortlistNotice.value = ''
  try {
    const results = await Promise.allSettled(picked.value.map((creatorId) =>
      request(API.shortlistAdd.path, { method: 'POST', body: JSON.stringify({ creatorId }) })))
    const added = results.filter((r) => r.status === 'fulfilled').length
    const gone = results.filter((r) => r.status === 'rejected' && (r.reason as { status?: number })?.status === 404).length
    const failed = results.length - added - gone
    const parts = [added ? t('kcs.console.shortlist.added', { n: added }) : '', gone ? t('kcs.console.shortlist.addSkipped', { n: gone }) : '']
    if (failed) parts.push(t('kcs.console.shortlist.failed'))
    shortlistNotice.value = parts.filter(Boolean).join(' · ')
    if (added && !failed) picked.value = []
  } finally {
    shortlisting.value = false
  }
}

async function assign() {
  if (!projectId.value || !picked.value.length) return
  assigning.value = true
  try {
    await request(apiPath(API.assign, { id: projectId.value }), {
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
  loadProject()
  loadReferenceLines()
  loadCategories()
  await loadQueries()
  await run()
})
// 条件改了又改回（包括进页面时选中第一个方案），和刚发出的那次一样就不再取。
const debouncedRun = useDebounceFn(() => (runKey() === lastRunKey ? undefined : run()), 300)
/**
 * 点一下就改完的（按钮、勾选、下拉）立即取数；打字（搜索框、编辑器里的数字）照旧停手 300ms 再取。
 * 捕获阶段先记下，改动触发的 watch 在同一轮里看到；没改动就在这一轮之后清掉。
 */
let discrete = false
function markDiscrete(e: Event) {
  if (!(e.target as Element | null)?.closest?.('button, select, input[type=checkbox], input[type=radio]')) return
  discrete = true
  setTimeout(() => { discrete = false })
}
// 条件一变回到第一页；page 本身的变化（翻页）立即取数。
function rerun() {
  Object.assign(cursors, { page: 0, next: null, prev: null })
  if (page.value !== 1) page.value = 1
  else if (discrete) {
    discrete = false
    if (runKey() !== lastRunKey) return run()
  } else debouncedRun()
}
watch(specJson, rerun)
watch(search, rerun)
watch(page, () => run())
watch(picked, () => {
  if (!picked.value.length) confirming.value = false
})
</script>
