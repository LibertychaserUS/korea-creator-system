<template>
  <main class="bg-background text-foreground">
    <!-- 首屏：潮声背景 + 顶栏 + 主张 + 产品预览 -->
    <div class="tide-landing relative overflow-hidden">
      <div class="tide-bg" aria-hidden="true">
        <div class="tide-swell tide-swell--warm" />
        <div class="tide-swell tide-swell--sea" />
        <div class="tide-swell tide-swell--sand" />
        <div class="tide-shore" />
        <TideCanvas />
      </div>

      <header class="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 md:px-8">
        <AppLogo size="md" />
        <nav class="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="sections">
          <a href="#workspaces" class="transition-colors hover:text-foreground">{{ t('kcs.landing.navWorkspaces') }}</a>
          <a href="#flow" class="transition-colors hover:text-foreground">{{ t('kcs.landing.navFlow') }}</a>
          <a href="#data" class="transition-colors hover:text-foreground">{{ t('kcs.landing.navScoring') }}</a>
        </nav>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 rounded-md border border-border/60 bg-background/70 p-1 backdrop-blur-sm">
            <LocaleSelect />
            <ThemeToggle />
          </div>
          <Button as-child size="sm" class="hidden sm:inline-flex">
            <NuxtLink :to="localePath('/login')">{{ t('kcs.panel.signIn') }}</NuxtLink>
          </Button>
        </div>
      </header>

      <section
        class="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-12 md:px-8 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28"
        data-testid="marketing-hero"
      >
        <div class="flex flex-col items-start gap-6 text-left">
          <p
            class="tide-line inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-primary backdrop-blur-sm"
            style="--line: 0"
          >
            <span class="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            {{ t('kcs.brand.eyebrow') }}
          </p>
          <h1 class="tide-line text-4xl font-semibold leading-[1.12] tracking-tight md:text-6xl" style="--line: 1">
            {{ t('kcs.brand.tagline') }}
          </h1>
          <p class="tide-line max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg" style="--line: 2">
            {{ t('kcs.brand.story') }}
          </p>
          <div class="tide-line flex flex-wrap items-center gap-3" style="--line: 3">
            <Button as-child size="lg" data-testid="cta-enter" class="h-11 px-6 shadow-md shadow-primary/20">
              <NuxtLink :to="localePath('/login')">
                {{ t('kcs.panel.signIn') }}
                <ArrowRight class="size-4" />
              </NuxtLink>
            </Button>
            <Button as-child size="lg" variant="outline" class="h-11 bg-background/60 px-6 backdrop-blur-sm">
              <a href="#workspaces">{{ t('kcs.panel.learnMore') }}</a>
            </Button>
          </div>
          <p class="tide-line font-mono text-xs tracking-[0.2em] text-muted-foreground/80" style="--line: 4">
            {{ t('kcs.brand.pillars') }}
          </p>
        </div>

        <!-- 产品预览：静态的达人库缩影 -->
        <div class="tide-line relative" style="--line: 2.5" aria-hidden="true">
          <div class="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-3xl" />
          <div class="overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-2xl shadow-primary/10 backdrop-blur">
            <div class="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div class="flex items-center gap-2">
                <span class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary"><Users class="size-4" /></span>
                <div class="leading-tight">
                  <p class="text-sm font-semibold">{{ t('kcs.landing.previewTitle') }}</p>
                  <p class="text-[11px] text-muted-foreground">{{ t('kcs.landing.previewMeta') }}</p>
                </div>
              </div>
              <span class="flex gap-1.5">
                <span class="size-2 rounded-full bg-border" />
                <span class="size-2 rounded-full bg-border" />
                <span class="size-2 rounded-full bg-primary/60" />
              </span>
            </div>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th class="px-4 py-2 text-left font-medium">{{ t('kcs.landing.previewCols.creator') }}</th>
                  <th class="px-2 py-2 text-left font-medium">{{ t('kcs.landing.previewCols.tier') }}</th>
                  <th class="px-2 py-2 text-right font-medium">{{ t('kcs.landing.previewCols.cpe') }}</th>
                  <th class="hidden px-4 py-2 text-right font-medium sm:table-cell">{{ t('kcs.landing.previewCols.fans') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/60">
                <tr v-for="row in preview" :key="row.name" class="[&:nth-child(2)]:bg-primary/5">
                  <td class="px-4 py-2.5">
                    <div class="flex items-center gap-2.5">
                      <span class="flex size-8 items-center justify-center rounded-full border border-border bg-muted text-xs text-muted-foreground">{{ row.name.charAt(0) }}</span>
                      <div class="min-w-0 leading-tight">
                        <p class="truncate font-medium">{{ row.name }}</p>
                        <p class="truncate text-[11px] text-muted-foreground">{{ row.tags }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-2 py-2.5"><TierBadge :tier="row.tier" /></td>
                  <td class="px-2 py-2.5 text-right font-semibold tabular-nums" :class="row.top ? 'text-primary' : ''">{{ row.cpe }}</td>
                  <td class="hidden px-4 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">{{ row.fans }}</td>
                </tr>
              </tbody>
            </table>
            <div class="flex items-center justify-between border-t border-border/60 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
              <span class="inline-flex items-center gap-1.5"><ShieldCheck class="size-3.5 text-primary" />{{ t('kcs.health.label') }} · {{ t('kcs.health.excellent') }}</span>
              <span class="inline-flex items-center gap-1.5 rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground"><UserPlus class="size-3.5" />{{ t('kcs.actions.assign') }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 工作台 -->
    <section id="workspaces" class="mx-auto w-full max-w-6xl scroll-mt-16 px-6 py-20 md:px-8">
      <SectionHead :eyebrow="t('kcs.landing.workspacesEyebrow')" :title="t('kcs.landing.workspacesTitle')" :lead="t('kcs.landing.workspacesLead')" />
      <div class="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <a
          v-for="(ws, index) in workspaces"
          :key="ws.key"
          :href="ws.url"
          :data-testid="`cta-${ws.key}`"
          class="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border/60 bg-card p-6 shadow-xs transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span class="absolute inset-x-0 top-0 h-0.5 opacity-80" :class="ws.bar" aria-hidden="true" />
          <div class="flex items-center justify-between">
            <span class="flex size-11 items-center justify-center rounded-lg" :class="ws.iconWrap" aria-hidden="true">
              <component :is="ws.icon" class="size-5" />
            </span>
            <span class="font-mono text-xs text-muted-foreground/70">0{{ index + 1 }}</span>
          </div>
          <div>
            <h3 class="text-lg font-semibold tracking-tight">{{ t(ws.label) }}</h3>
            <p class="mt-1 text-sm leading-relaxed text-muted-foreground">{{ t(ws.desc) }}</p>
          </div>
          <ul class="space-y-1.5 text-sm text-muted-foreground">
            <li v-for="point in ws.points" :key="point" class="flex items-center gap-2">
              <Check class="size-3.5 shrink-0 text-primary" />
              {{ t(point) }}
            </li>
          </ul>
          <span class="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium">
            {{ t(ws.cta) }}
            <ArrowRight class="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </a>
      </div>
    </section>

    <!-- 流程 -->
    <section id="flow" class="scroll-mt-16 border-y border-border/60 bg-muted/30">
      <div class="mx-auto w-full max-w-6xl px-6 py-20 md:px-8">
        <SectionHead :eyebrow="t('kcs.landing.flowEyebrow')" :title="t('kcs.landing.flowTitle')" />
        <ol class="mt-12 grid gap-8 md:grid-cols-4 md:gap-6">
          <li v-for="(step, i) in steps" :key="i" class="relative">
            <div class="flex items-center gap-3 md:block">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background font-mono text-sm font-semibold text-primary">
                {{ i + 1 }}
              </span>
              <span v-if="i < steps.length - 1" class="absolute left-[calc(2.25rem+0.5rem)] right-[-1.5rem] top-[1.1rem] hidden h-px bg-gradient-to-r from-primary/40 to-border md:block" aria-hidden="true" />
              <h3 class="text-base font-semibold md:mt-4">{{ rt(step.title) }}</h3>
            </div>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground md:mt-2">{{ rt(step.body) }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- 数据：平台给什么，我们看什么 -->
    <section id="data" class="mx-auto w-full max-w-6xl scroll-mt-16 px-6 py-20 md:px-8" data-testid="marketing-data">
      <SectionHead :eyebrow="t('kcs.landing.dataEyebrow')" :title="t('kcs.landing.dataTitle')" :lead="t('kcs.landing.dataLead')" />

      <h3 class="mt-10 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{{ t('kcs.landing.sourcesTitle') }}</h3>
      <div class="mt-4 grid gap-4 md:grid-cols-3">
        <div v-for="src in sources" :key="src.id" class="relative overflow-hidden rounded-xl border border-border/60 bg-card p-6 shadow-xs">
          <span class="absolute inset-x-0 top-0 h-0.5" :class="src.route === 'official' ? 'bg-primary' : 'bg-amber-500/70'" aria-hidden="true" />
          <span class="inline-flex rounded-md border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">{{ t(`kcs.source.${src.route}`) }}</span>
          <h4 class="mt-3 text-base font-semibold">{{ t(`kcs.landing.sources.${src.id}.label`) }}</h4>
          <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ t(`kcs.landing.sources.${src.id}.body`) }}</p>
        </div>
      </div>

      <div class="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div class="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
          <h3 class="text-sm font-semibold">{{ t('kcs.landing.groupsTitle') }}</h3>
          <ul class="mt-4 grid gap-4 sm:grid-cols-2">
            <li v-for="group in groups" :key="group" class="rounded-lg border border-border/50 bg-muted/30 p-4">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">{{ groupLabel(group) }}</span>
                <span class="font-mono text-[11px] tabular-nums text-muted-foreground">{{ fieldsIn(group).length }}</span>
              </div>
              <p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">{{ t(`kcs.landing.groups.${group}`) }}</p>
              <div class="mt-3 flex flex-wrap gap-1">
                <span v-for="f in fieldsIn(group).slice(0, 5)" :key="f.key" class="rounded-sm bg-background px-1.5 py-0.5 text-[11px] text-foreground/80 ring-1 ring-border/60">{{ label(f.key) }}</span>
              </div>
            </li>
          </ul>
        </div>
        <div class="flex flex-col gap-4">
          <div class="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h3 class="text-sm font-semibold">{{ t('kcs.landing.tierTitle') }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ t('kcs.landing.tierBody') }}</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <TierBadge v-for="tier in tiers" :key="tier" :tier="tier" />
            </div>
          </div>
          <div class="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h3 class="text-sm font-semibold">{{ t('kcs.landing.gateTitle') }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ t('kcs.landing.gateBody') }}</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <HealthBadge health="healthy" />
              <HealthBadge health="abnormal" />
              <HealthBadge health="healthy" low-active />
            </div>
          </div>
          <div class="tide-rule-card relative overflow-hidden rounded-xl p-6 text-white">
            <p class="text-xs uppercase tracking-[0.16em] text-white/60">{{ t('kcs.landing.transformTitle') }}</p>
            <p class="mt-2 text-lg font-semibold leading-snug text-white">{{ t('kcs.landing.transformLine') }}</p>
            <p class="mt-3 text-sm leading-relaxed text-white/75">{{ t('kcs.landing.transformBody') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 主张 -->
    <section class="border-t border-border/60 bg-muted/30">
      <div class="mx-auto grid w-full max-w-6xl gap-8 px-6 py-16 md:grid-cols-3 md:px-8">
        <div v-for="(v, i) in values" :key="i" class="space-y-2">
          <div class="h-px w-8 bg-primary/60" aria-hidden="true" />
          <h3 class="text-base font-semibold">{{ rt(v.title) }}</h3>
          <p class="text-sm leading-relaxed text-muted-foreground">{{ rt(v.body) }}</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="mx-auto w-full max-w-6xl px-6 py-20 md:px-8">
      <div class="tide-cta relative overflow-hidden rounded-2xl px-6 py-14 text-center text-white md:px-12">
        <div class="tide-cta-glow" aria-hidden="true" />
        <h2 class="relative text-3xl font-semibold tracking-tight md:text-4xl">{{ t('kcs.landing.ctaTitle') }}</h2>
        <p class="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/75 md:text-base">{{ t('kcs.landing.ctaLead') }}</p>
        <div class="relative mt-8 flex justify-center">
          <Button as-child size="lg" variant="secondary" class="h-11 px-7">
            <NuxtLink :to="localePath('/login')">
              {{ t('kcs.panel.signIn') }}
              <ArrowRight class="size-4" />
            </NuxtLink>
          </Button>
        </div>
      </div>
    </section>

    <footer class="border-t border-border/60">
      <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-8">
        <div class="flex items-center gap-3">
          <AppLogo size="sm" />
          <span class="text-xs text-muted-foreground">{{ t('kcs.landing.footerNote') }}</span>
        </div>
        <nav class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground" :aria-label="t('kcs.landing.footerLinks')">
          <a v-for="ws in workspaces" :key="ws.key" :href="ws.url" class="transition-colors hover:text-foreground">{{ t(ws.label) }}</a>
          <NuxtLink :to="localePath('/login')" class="transition-colors hover:text-foreground">{{ t('kcs.panel.signIn') }}</NuxtLink>
        </nav>
        <p class="text-xs text-muted-foreground">{{ t('kcs.panel.homeLead') }}</p>
      </div>
    </footer>
  </main>
</template>

<script setup lang="ts">
// 听潮 · 宣传页：公开落地页，无工作台侧栏；语言/主题与登录页同一套潮声。
import { h, type FunctionalComponent } from 'vue'
import { Activity, ArrowRight, Check, ClipboardList, ShieldCheck, UserPlus, Users } from 'lucide-vue-next'
import { CREATOR_TIERS, SOURCE_IDS, SOURCE_ROUTE, type CreatorTier } from '@kcs/contract'

definePageMeta({ layout: false })

const { t, tm, rt, locale } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()

type Msg = { title: string; body: string }
const steps = computed(() => (tm('kcs.landing.steps') as Msg[]) || [])
const values = computed(() => (tm('kcs.landing.values') as Msg[]) || [])

const { label, groupLabel, groups, fieldsIn } = useMetrics()
const sources = SOURCE_IDS.map((id) => ({ id, route: SOURCE_ROUTE[id] }))
const tiers = CREATOR_TIERS.map((x) => x.id).filter((x) => x !== 'unknown') as CreatorTier[]

const preview = [
  { name: '清潭洞护肤', tags: 'beauty · 护肤 · 时尚', tier: 'mid' as const, cpe: '¥1.8', fans: '375K', top: true },
  { name: '서울살림노트', tags: 'home · 생활 · 韩系家居', tier: 'mid' as const, cpe: '¥2.4', fans: '428K', top: true },
  { name: '济州咖啡日记', tags: 'food · 探店 · 咖啡', tier: 'mid' as const, cpe: '¥3.1', fans: '61K', top: false },
  { name: '明洞开箱Leo', tags: 'unbox · 开箱 · vlog', tier: 'head' as const, cpe: '¥5.6', fans: '910K', top: false },
]

const workspaces = computed(() => [
  {
    key: 'select',
    label: 'kcs.nav.select',
    desc: 'kcs.panel.selectDesc',
    cta: 'kcs.panel.openSelect',
    url: `${config.public.selectUrl}/${locale.value}/`,
    icon: Users,
    iconWrap: 'bg-primary/10 text-primary',
    bar: 'bg-primary',
    points: ['kcs.panel.pool', 'kcs.panel.projects', 'kcs.panel.assign'],
  },
  {
    key: 'ops',
    label: 'kcs.nav.ops',
    desc: 'kcs.panel.opsDesc',
    cta: 'kcs.panel.openOps',
    url: `${config.public.opsUrl}/${locale.value}/`,
    icon: ClipboardList,
    iconWrap: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-500',
    points: ['kcs.panel.createCreator', 'kcs.panel.review', 'kcs.panel.publish'],
  },
  {
    key: 'dev',
    label: 'kcs.nav.monitor',
    desc: 'kcs.panel.devDesc',
    cta: 'kcs.panel.openDev',
    url: `${config.public.devUrl}/${locale.value}/`,
    icon: Activity,
    iconWrap: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    points: ['kcs.panel.jobs', 'kcs.panel.failures', 'kcs.panel.retry'],
  },
])

/** 区块标题：眉题 + 标题 + 引言，三个区块共用。 */
const SectionHead: FunctionalComponent<{ eyebrow: string; title: string; lead?: string }> = (props) =>
  h('div', { class: 'max-w-2xl' }, [
    h('p', { class: 'flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-primary' }, [
      h('span', { class: 'h-px w-5 bg-primary/60', 'aria-hidden': 'true' }),
      props.eyebrow,
    ]),
    h('h2', { class: 'mt-3 text-2xl font-semibold tracking-tight md:text-4xl' }, props.title),
    props.lead ? h('p', { class: 'mt-3 text-base leading-relaxed text-muted-foreground' }, props.lead) : null,
  ])
SectionHead.props = ['eyebrow', 'title', 'lead']

useHead({
  title: () => t('kcs.brand.title'),
  htmlAttrs: { lang: locale },
})
</script>

<style scoped>
/* Warm tide background — same language as layouts/auth.vue in libs/panel. */
.tide-landing {
  background: linear-gradient(
    168deg,
    oklch(0.975 0.012 85) 0%,
    oklch(0.955 0.015 130) 42%,
    oklch(0.94 0.02 220) 100%
  );
}

.tide-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.tide-swell {
  position: absolute;
  border-radius: 9999px;
  filter: blur(72px);
  will-change: transform;
}

.tide-swell--warm {
  width: 55vmax;
  height: 55vmax;
  left: -12vmax;
  top: -18vmax;
  background: radial-gradient(circle, oklch(0.88 0.07 75 / 0.55) 0%, transparent 65%);
  animation: tide-drift-a 26s ease-in-out infinite alternate;
}

.tide-swell--sea {
  width: 60vmax;
  height: 60vmax;
  right: -15vmax;
  bottom: -22vmax;
  background: radial-gradient(circle, oklch(0.8 0.06 225 / 0.5) 0%, transparent 65%);
  animation: tide-drift-b 32s ease-in-out infinite alternate;
}

.tide-swell--sand {
  width: 38vmax;
  height: 38vmax;
  right: 8vmax;
  top: -10vmax;
  background: radial-gradient(circle, oklch(0.9 0.05 95 / 0.45) 0%, transparent 65%);
  animation: tide-drift-a 38s ease-in-out infinite alternate-reverse;
}

.tide-shore {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 34%;
  background: linear-gradient(to top, oklch(0.86 0.04 215 / 0.28) 0%, transparent 100%);
  animation: tide-breathe 14s ease-in-out infinite alternate;
}

@keyframes tide-drift-a {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(6vmax, 4vmax, 0) scale(1.12); }
}

@keyframes tide-drift-b {
  from { transform: translate3d(0, 0, 0) scale(1.05); }
  to { transform: translate3d(-5vmax, -4vmax, 0) scale(0.96); }
}

@keyframes tide-breathe {
  from { opacity: 0.55; transform: translateY(0); }
  to { opacity: 0.9; transform: translateY(-1.5%); }
}

/* 深色：整个选择器必须放进 :global()，`:global(.dark) .x` 会被 scoped 编译成裸 `.dark` */
:global(.dark .tide-landing) {
  background: linear-gradient(
    168deg,
    oklch(0.2 0.014 70) 0%,
    oklch(0.18 0.012 200) 45%,
    oklch(0.17 0.018 250) 100%
  );
}

:global(.dark .tide-landing .tide-swell--warm) {
  background: radial-gradient(circle, oklch(0.5 0.08 70 / 0.28) 0%, transparent 65%);
}

:global(.dark .tide-landing .tide-swell--sea) {
  background: radial-gradient(circle, oklch(0.45 0.07 230 / 0.3) 0%, transparent 65%);
}

:global(.dark .tide-landing .tide-swell--sand) {
  background: radial-gradient(circle, oklch(0.48 0.05 90 / 0.22) 0%, transparent 65%);
}

:global(.dark .tide-landing .tide-shore) {
  background: linear-gradient(to top, oklch(0.35 0.05 225 / 0.25) 0%, transparent 100%);
}

/* 深海色块：规则版本卡 + 底部 CTA，亮暗两态同色，白字。 */
.tide-rule-card,
.tide-cta {
  background: linear-gradient(160deg, oklch(0.36 0.06 215) 0%, oklch(0.26 0.05 235) 55%, oklch(0.2 0.04 250) 100%);
}

.tide-cta-glow {
  position: absolute;
  inset: auto -20% -60% auto;
  width: 60%;
  aspect-ratio: 1;
  border-radius: 9999px;
  background: radial-gradient(circle, oklch(0.75 0.1 200 / 0.4) 0%, transparent 65%);
  filter: blur(40px);
  pointer-events: none;
}

/* Opening lines rise in with the tide — staggered, calm, no layout shift. */
.tide-line {
  opacity: 0;
  transform: translateY(10px);
  animation: tide-line-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(0.35s + var(--line, 0) * 0.45s);
}

@keyframes tide-line-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tide-swell,
  .tide-shore {
    animation: none;
  }
  .tide-line {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
