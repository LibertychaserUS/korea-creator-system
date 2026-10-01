<template>
  <main class="scroll" :class="{ 'scroll--intro': playIntro }">
    <!-- 书脊式竖轨：桌面固定左侧，深青整面；移动端收为顶部横条 -->
    <aside class="rail">
      <div class="rail-head">
        <AppLogo size="sm" variant="icon-only" />
      </div>

      <p class="rail-title" :class="{ 'rail-title--v': isZh }" aria-hidden="true">
        <span v-for="(ch, i) in titleChars" :key="i" class="rail-title-ch" :style="{ '--i': i }">{{ ch }}</span>
      </p>

      <nav class="rail-nav" :class="{ 'rail-nav--v': isZh }" aria-label="sections">
        <a v-for="item in railNav" :key="item.href" :href="item.href" class="lnk lnk--rail">{{ t(item.label) }}</a>
      </nav>

      <div class="rail-foot">
        <LocaleSelect />
        <ThemeToggle />
        <NuxtLink :to="localePath('/login')" class="lnk lnk--rail lnk--foot">{{ t('kcs.panel.signIn') }}</NuxtLink>
      </div>
    </aside>

    <!-- 内容书页 -->
    <div class="sheet">
      <!-- Hero：sticky 钉住，滚动时渐隐上移，像翻过一页 -->
      <div ref="heroStretch" class="hero-stretch">
        <section class="hero" data-testid="marketing-hero" :style="heroStyle">
          <div class="hero-tide" aria-hidden="true">
            <TideField :seed="3" :amplitude="18" :opacity="0.85" />
          </div>
          <TideCanvas class="hero-ripples" aria-hidden="true" />

          <div class="hero-inner">
            <div class="hero-copy">
              <p class="eyebrow">{{ t('kcs.brand.eyebrow') }}</p>
              <h1 class="hero-title">{{ t('kcs.brand.tagline') }}</h1>
              <p class="hero-story">{{ t('kcs.brand.story') }}</p>
              <div class="hero-cta">
                <NuxtLink :to="localePath('/login')" class="lnk lnk--cta" data-testid="cta-enter">
                  {{ t('kcs.panel.signIn') }}
                </NuxtLink>
                <a href="mailto:admin@kcs.local" class="lnk lnk--cta" data-testid="cta-request">
                  {{ t('kcs.landing.requestAccess') }}
                </a>
                <a href="#workspaces" class="lnk">{{ t('kcs.panel.learnMore') }}</a>
              </div>
              <p class="hero-pillars">{{ t('kcs.brand.pillars') }}</p>
            </div>

            <!-- 产品缩影：去阴影、发丝线框的标本面板 -->
            <div class="specimen" aria-label="product preview">
              <div class="specimen-head">
                <p class="specimen-title">{{ t('kcs.landing.previewTitle') }}</p>
                <p class="specimen-meta">{{ t('kcs.landing.previewMeta') }}</p>
              </div>
              <table class="specimen-table">
                <thead>
                  <tr>
                    <th class="text-left">{{ t('kcs.landing.previewCols.creator') }}</th>
                    <th class="text-left">{{ t('kcs.landing.previewCols.tier') }}</th>
                    <th class="text-right">{{ t('kcs.landing.previewCols.cpe') }}</th>
                    <th class="text-right hide-sm">{{ t('kcs.landing.previewCols.fans') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in preview" :key="row.name">
                    <td>
                      <p class="specimen-name">{{ row.name }}</p>
                      <p class="specimen-tags">{{ row.tags }}</p>
                    </td>
                    <td><TierBadge :tier="row.tier" /></td>
                    <td class="num" :class="{ 'num--top': row.top }">{{ row.cpe }}</td>
                    <td class="num num--dim hide-sm">{{ row.fans }}</td>
                  </tr>
                </tbody>
              </table>
              <div class="specimen-foot">
                <span class="inline-flex items-center gap-1.5">
                  <ShieldCheck class="size-3.5 text-primary" />
                  {{ t('kcs.health.label') }} · {{ t('kcs.health.healthy') }}
                </span>
                <span class="specimen-assign">{{ t('kcs.actions.assign') }}</span>
              </div>
            </div>
          </div>

          <p class="hero-hint" aria-hidden="true">{{ t('kcs.landing.scrollHint') }}</p>
        </section>
      </div>

      <!-- 呼吸区：节间气口，只有潮汐线 -->
      <div class="breath" aria-hidden="true"><TideField :seed="11" :amplitude="12" :opacity="0.6" /></div>

      <!-- 工作台 -->
      <section id="workspaces" class="section">
        <header class="section-head">
          <p class="eyebrow">{{ t('kcs.landing.workspacesEyebrow') }}</p>
          <h2>{{ t('kcs.landing.workspacesTitle') }}</h2>
          <p class="lead">{{ t('kcs.landing.workspacesLead') }}</p>
        </header>
        <div class="ws-grid">
          <article v-for="(ws, index) in workspaces" :key="ws.key" class="ws-cell">
            <p class="ws-index">0{{ index + 1 }}</p>
            <component :is="ws.icon" class="ws-icon" aria-hidden="true" />
            <h3>{{ t(ws.label) }}</h3>
            <p class="ws-desc">{{ t(ws.desc) }}</p>
            <ul class="ws-points">
              <li v-for="point in ws.points" :key="point">
                <Check class="size-3.5 shrink-0" aria-hidden="true" />
                {{ t(point) }}
              </li>
            </ul>
            <a :href="ws.url" class="lnk" :data-testid="`cta-${ws.key}`">{{ t(ws.cta) }}</a>
          </article>
        </div>
      </section>

      <!-- 流程 -->
      <section id="flow" class="section">
        <header class="section-head">
          <p class="eyebrow">{{ t('kcs.landing.flowEyebrow') }}</p>
          <h2>{{ t('kcs.landing.flowTitle') }}</h2>
        </header>
        <ol class="flow-grid">
          <li v-for="(step, i) in steps" :key="i" class="flow-cell">
            <p class="flow-num">0{{ i + 1 }}</p>
            <h3>{{ rt(step.title) }}</h3>
            <p>{{ rt(step.body) }}</p>
          </li>
        </ol>
      </section>

      <div class="breath" aria-hidden="true"><TideField :seed="29" :amplitude="10" :opacity="0.5" /></div>

      <!-- 数据 -->
      <section id="data" class="section" data-testid="marketing-data">
        <header class="section-head">
          <p class="eyebrow">{{ t('kcs.landing.dataEyebrow') }}</p>
          <h2>{{ t('kcs.landing.dataTitle') }}</h2>
          <p class="lead">{{ t('kcs.landing.dataLead') }}</p>
        </header>

        <h3 class="block-label">{{ t('kcs.landing.sourcesTitle') }}</h3>
        <div class="src-grid">
          <article v-for="src in sources" :key="src.id" class="src-cell">
            <p class="src-route">{{ t(`kcs.source.${src.route}`) }}</p>
            <h4>{{ t(`kcs.landing.sources.${src.id}.label`) }}</h4>
            <p>{{ t(`kcs.landing.sources.${src.id}.body`) }}</p>
          </article>
        </div>

        <div class="data-grid">
          <div class="groups-panel">
            <h3 class="block-label">{{ t('kcs.landing.groupsTitle') }}</h3>
            <ul class="groups-list">
              <li v-for="group in groups" :key="group">
                <div class="groups-row">
                  <span class="groups-name">{{ groupLabel(group) }}</span>
                  <span class="groups-count">{{ fieldsIn(group).length }}</span>
                </div>
                <p>{{ t(`kcs.landing.groups.${group}`) }}</p>
              </li>
            </ul>
          </div>

          <div class="side-stack">
            <div class="side-cell">
              <h3 class="block-label">{{ t('kcs.landing.tierTitle') }}</h3>
              <p class="side-body">{{ t('kcs.landing.tierBody') }}</p>
              <div class="badge-row"><TierBadge v-for="tier in tiers" :key="tier" :tier="tier" /></div>
            </div>
            <div class="side-cell">
              <h3 class="block-label">{{ t('kcs.landing.gateTitle') }}</h3>
              <p class="side-body">{{ t('kcs.landing.gateBody') }}</p>
              <div class="badge-row">
                <HealthBadge health="healthy" />
                <HealthBadge health="abnormal" />
                <HealthBadge health="healthy" low-active />
              </div>
            </div>
            <div class="side-cell side-cell--rule">
              <h3 class="block-label">{{ t('kcs.landing.transformTitle') }}</h3>
              <p class="transform-line">{{ t('kcs.landing.transformLine') }}</p>
              <p class="side-body">{{ t('kcs.landing.transformBody') }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 主张 -->
      <section id="values" class="section">
        <div class="values-grid">
          <div v-for="(v, i) in values" :key="i" class="value-cell">
            <p class="ws-index">0{{ i + 1 }}</p>
            <h3>{{ rt(v.title) }}</h3>
            <p>{{ rt(v.body) }}</p>
          </div>
        </div>
      </section>

      <div class="breath" aria-hidden="true"><TideField :seed="47" :amplitude="9" :opacity="0.45" /></div>

      <!-- CTA -->
      <section class="section cta">
        <h2 class="cta-title">{{ t('kcs.landing.ctaTitle') }}</h2>
        <p class="lead">{{ t('kcs.landing.ctaLead') }}</p>
        <div class="cta-links">
          <NuxtLink :to="localePath('/login')" class="lnk lnk--cta" data-testid="cta-enter-bottom">
            {{ t('kcs.panel.signIn') }}
          </NuxtLink>
          <a href="mailto:admin@kcs.local" class="lnk lnk--cta" data-testid="cta-request-bottom">
            {{ t('kcs.landing.requestAccess') }}
          </a>
        </div>
      </section>

      <footer class="foot">
        <div class="foot-brand">
          <AppLogo size="sm" />
          <p>{{ t('kcs.landing.footerNote') }}</p>
        </div>
        <nav class="foot-nav" :aria-label="t('kcs.landing.footerLinks')">
          <a v-for="ws in workspaces" :key="ws.key" :href="ws.url" class="lnk">{{ t(ws.label) }}</a>
          <NuxtLink :to="localePath('/login')" class="lnk">{{ t('kcs.panel.signIn') }}</NuxtLink>
        </nav>
        <p class="foot-tag">{{ t('kcs.landing.footerTagline') }}</p>
      </footer>
    </div>

    <!-- 移动端锚点排 -->
    <nav class="mobile-nav" aria-label="sections">
      <a v-for="item in railNav" :key="item.href" :href="item.href" class="lnk">{{ t(item.label) }}</a>
      <NuxtLink :to="localePath('/login')" class="lnk">{{ t('kcs.panel.signIn') }}</NuxtLink>
    </nav>
  </main>
</template>

<script setup lang="ts">
// 听潮 · 宣传页「潮汐志」：书卷式竖轨 + 画廊式滚动叙事 + 生成式潮汐画布。
// 对外门面，无工作台侧栏；语言/主题与登录页同一套。
import { Activity, Check, ClipboardList, ShieldCheck, Users } from 'lucide-vue-next'
import { CREATOR_TIERS, SOURCE_IDS, SOURCE_ROUTE, type CreatorTier } from '@kcs/contract'

definePageMeta({ layout: false })

const { t, tm, rt, locale } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()

const isZh = computed(() => locale.value === 'zh-CN')

const railNav = [
  { href: '#workspaces', label: 'kcs.landing.navWorkspaces' },
  { href: '#flow', label: 'kcs.landing.navFlow' },
  { href: '#data', label: 'kcs.landing.navScoring' },
  { href: '#values', label: 'kcs.landing.navValues' },
]

// 竖排大字：zh 逐字（竖排），en/ko 用品牌短名横排小字。
const titleChars = computed(() => (isZh.value ? ['听', '潮'] : [t('kcs.brand.short')]))

// 开场动效：首访只播一次（sessionStorage 记录）。SSR 输出终态，客户端首访才挂 intro 类。
const playIntro = ref(false)
if (import.meta.client) {
  try {
    playIntro.value = !sessionStorage.getItem('kcs.scroll.opened')
  } catch {
    playIntro.value = true
  }
}
onMounted(() => {
  if (!playIntro.value) return
  const timer = window.setTimeout(() => {
    try {
      sessionStorage.setItem('kcs.scroll.opened', '1')
    } catch {
      /* 私密模式等场景忽略 */
    }
  }, 3200)
  onBeforeUnmount(() => window.clearTimeout(timer))
})

// Hero 钉住渐隐：progress 0→1，opacity 渐隐 + 轻微上移（翻页过渡）。
const heroStretch = ref<HTMLElement | null>(null)
const scrollY = ref(0)
const wide = ref(false)
const reduceMotion = ref(false)

const heroProgress = computed(() => {
  if (!wide.value || reduceMotion.value) return 0
  const el = heroStretch.value
  if (!el) return 0
  const range = Math.max(el.offsetHeight - window.innerHeight, 1)
  return Math.min(1, Math.max(0, scrollY.value / range))
})

const heroStyle = computed(() => {
  const p = heroProgress.value
  return {
    opacity: String(1 - p * 0.92),
    transform: `translateY(${(-36 * p).toFixed(1)}px)`,
  }
})

let onScroll: (() => void) | null = null
onMounted(() => {
  reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const mq = window.matchMedia('(min-width: 1024px)')
  wide.value = mq.matches
  const syncWide = (e: MediaQueryListEvent) => {
    wide.value = e.matches
  }
  let raf = 0
  onScroll = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      scrollY.value = window.scrollY
    })
  }
  mq.addEventListener('change', syncWide)
  window.addEventListener('scroll', onScroll, { passive: true })
  onBeforeUnmount(() => {
    mq.removeEventListener('change', syncWide)
    window.removeEventListener('scroll', onScroll!)
    if (raf) cancelAnimationFrame(raf)
  })
})

type Msg = { title: string; body: string }
const steps = computed(() => (tm('kcs.landing.steps') as Msg[]) || [])
const values = computed(() => (tm('kcs.landing.values') as Msg[]) || [])

const { label: _label, groupLabel, groups, fieldsIn } = useMetrics()
const sources = SOURCE_IDS.map((id) => ({ id, route: SOURCE_ROUTE[id] }))
const tiers = CREATOR_TIERS.map((x) => x.id).filter((x) => x !== 'unknown') as CreatorTier[]

// 预览表四条达人昵称走 i18n（zh 保留原名，en/ko 给本地化示例名），避免非中文页面穿帮。
const previewRows = [
  { tags: 'beauty · 护肤 · 时尚', tier: 'mid' as const, cpe: '¥1.8', fans: '375K', top: true },
  { tags: 'home · 생활 · 韩系家居', tier: 'mid' as const, cpe: '¥2.4', fans: '428K', top: true },
  { tags: 'food · 探店 · 咖啡', tier: 'mid' as const, cpe: '¥3.1', fans: '61K', top: false },
  { tags: 'unbox · 开箱 · vlog', tier: 'head' as const, cpe: '¥5.6', fans: '910K', top: false },
]
const previewNames = computed(() => (tm('kcs.landing.previewNames') as string[]) || [])
const preview = computed(() => previewRows.map((row, i) => ({ ...row, name: rt(previewNames.value[i] ?? '') })))

const workspaces = computed(() => [
  {
    key: 'select',
    label: 'kcs.nav.select',
    desc: 'kcs.panel.selectDesc',
    cta: 'kcs.panel.openSelect',
    url: `${config.public.selectUrl}/${locale.value}/`,
    icon: Users,
    points: ['kcs.panel.pool', 'kcs.panel.projects', 'kcs.panel.assign'],
  },
  {
    key: 'ops',
    label: 'kcs.nav.ops',
    desc: 'kcs.panel.opsDesc',
    cta: 'kcs.panel.openOps',
    url: `${config.public.opsUrl}/${locale.value}/`,
    icon: ClipboardList,
    points: ['kcs.panel.createCreator', 'kcs.panel.review', 'kcs.panel.publish'],
  },
  {
    key: 'dev',
    label: 'kcs.nav.monitor',
    desc: 'kcs.panel.devDesc',
    cta: 'kcs.panel.openDev',
    url: `${config.public.devUrl}/${locale.value}/`,
    icon: Activity,
    points: ['kcs.panel.jobs', 'kcs.panel.failures', 'kcs.panel.retry'],
  },
])

useHead({
  title: () => t('kcs.brand.title'),
  htmlAttrs: { lang: locale },
})
</script>

<style scoped>
/* ============ 设计令牌 ============ */
.scroll {
  --paper: #faf9f7;
  --paper-dim: #f1eee8;
  --ink: #1a1a1a;
  --ink-65: rgba(26, 26, 26, 0.65);
  --ink-45: rgba(26, 26, 26, 0.45);
  --tide: #093753;
  --sea: #2f5f8f;
  --hairline: rgba(9, 55, 83, 0.16);
  --rail-w: 260px;
  --gutter: clamp(20px, 4vw, 56px);
  --section-gap: clamp(72px, 10vw, 128px);
  --ease: cubic-bezier(0.33, 0, 0.66, 1);

  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif;
  font-feature-settings: "palt";
  font-size: clamp(15px, 0.6vw + 12px, 16px);
  line-height: 1.7;
}

:global(.dark) .scroll {
  --paper: #12181d;
  --paper-dim: #182028;
  --ink: #e8e6e1;
  --ink-65: rgba(232, 230, 225, 0.65);
  --ink-45: rgba(232, 230, 225, 0.45);
  --hairline: rgba(151, 199, 214, 0.2);
}

/* 自定义滚动条：6px、深色青拇指 */
:global(html) {
  scrollbar-width: thin;
  scrollbar-color: #093753 rgba(9, 55, 83, 0.08);
  scroll-behavior: smooth;
}
:global(::-webkit-scrollbar) {
  width: 6px;
  height: 6px;
}
:global(::-webkit-scrollbar-thumb) {
  background: #093753;
}
:global(::-webkit-scrollbar-track) {
  background: transparent;
}

/* ============ 去 chrome 链接按钮：文字 + 下划线生长 ============ */
.lnk {
  color: var(--tide);
  text-decoration: none;
  background-image: linear-gradient(currentColor, currentColor);
  background-size: 0% 1px;
  background-repeat: no-repeat;
  background-position: left calc(100% - 0.09em);
  padding-bottom: 0.18em;
  transition: background-size 0.25s var(--ease), color 0.25s var(--ease);
  cursor: pointer;
}
.lnk:hover,
.lnk:focus-visible {
  background-size: 100% 1px;
}
.lnk--rail {
  color: rgba(250, 249, 247, 0.78);
}
.lnk--rail:hover,
.lnk--rail:focus-visible {
  color: var(--paper);
}
.lnk--cta {
  font-size: clamp(16px, 1.1vw + 12px, 18px);
  font-weight: 500;
}

/* ============ 竖轨（书脊） ============ */
.rail {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  width: var(--rail-w);
  padding: calc(var(--gutter) * 0.8) calc(var(--gutter) * 0.7);
  background: var(--tide);
  color: var(--paper);
}
/* 10px 竖条：轨与书页的分界，开场时从下往上长出 */
.rail::after {
  content: "";
  position: absolute;
  top: 0;
  right: -10px;
  bottom: 0;
  width: 10px;
  background: var(--tide);
  transform: scaleY(1);
  transform-origin: bottom;
}

.rail-head {
  display: flex;
  align-items: center;
}

.rail-title {
  display: flex;
  gap: 0.4em;
  margin: var(--section-gap) 0 0;
  font-size: clamp(40px, 4vw, 56px);
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.28em;
  color: var(--paper);
}
.rail-title--v {
  writing-mode: vertical-rl;
  letter-spacing: 0.32em;
}
.rail-title-ch {
  display: inline-block;
}

.rail-nav {
  display: flex;
  flex-direction: column;
  gap: 1.6em;
  margin-top: calc(var(--section-gap) * 0.8);
  font-size: 14px;
}
.rail-nav--v {
  writing-mode: vertical-rl;
  gap: 2.2em;
  letter-spacing: 0.18em;
}

.rail-foot {
  display: flex;
  align-items: center;
  gap: 0.4em;
  margin-top: auto;
  font-size: 13px;
}
.lnk--foot {
  margin-left: auto;
}
/* 共享层按钮去 chrome（语言/主题切换） */
.rail-foot :deep(button) {
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  color: rgba(250, 249, 247, 0.78);
  height: auto;
  padding: 0.2em 0.3em;
}
.rail-foot :deep(button:hover) {
  background: transparent;
  color: var(--paper);
}

/* ============ 书页 ============ */
.sheet {
  margin-left: var(--rail-w);
}

/* Hero：sticky 钉住 + 滚动渐隐 */
.hero-stretch {
  height: 170vh;
}
.hero {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100svh;
  overflow: hidden;
  padding: calc(var(--gutter) * 1.2) var(--gutter);
  will-change: opacity, transform;
}
.hero-tide {
  position: absolute;
  inset: auto 0 0 0;
  height: 42%;
  pointer-events: none;
}
.hero-ripples {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  pointer-events: none;
}

.hero-inner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: calc(var(--gutter) * 1.4);
  align-items: center;
  max-width: 1180px;
  margin: 0 auto;
  width: 100%;
}

.eyebrow {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--sea);
}
.hero-title {
  margin: 0.35em 0 0;
  font-size: clamp(48px, 6vw, 88px);
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: 0.01em;
  text-wrap: balance;
}
.hero-story {
  max-width: 34em;
  margin: 1.2em 0 0;
  color: var(--ink-65);
  font-size: clamp(15px, 0.6vw + 12px, 17px);
}
.hero-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 1.6em;
  margin-top: 2.2em;
  align-items: baseline;
}
.hero-pillars {
  margin: 2.6em 0 0;
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--ink-45);
}
.hero-hint {
  position: absolute;
  right: var(--gutter);
  bottom: calc(var(--gutter) * 0.7);
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.24em;
  color: var(--ink-45);
  writing-mode: vertical-rl;
}

/* 标本面板：发丝线框，无阴影 */
.specimen {
  border-top: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
  background: color-mix(in srgb, var(--paper) 82%, transparent);
}
.specimen-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1em;
  padding: 0.9em 0;
}
.specimen-title {
  margin: 0;
  font-weight: 500;
}
.specimen-meta {
  margin: 0;
  font-size: 12px;
  color: var(--ink-45);
}
.specimen-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.specimen-table th {
  padding: 0.6em 0;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-45);
  border-top: 1px solid var(--hairline);
}
.specimen-table td {
  padding: 0.75em 0;
  border-top: 1px solid var(--hairline);
  vertical-align: middle;
}
.specimen-table th + th,
.specimen-table td + td {
  padding-left: 0.8em;
}
.specimen-name {
  margin: 0;
  font-weight: 500;
  line-height: 1.3;
}
.specimen-tags {
  margin: 0.15em 0 0;
  font-size: 11px;
  color: var(--ink-45);
}
.num {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.num--top {
  color: var(--sea);
}
.num--dim {
  color: var(--ink-45);
  font-weight: 400;
}
.specimen-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8em 0;
  border-top: 1px solid var(--hairline);
  font-size: 12px;
  color: var(--ink-65);
}
.specimen-assign {
  color: var(--tide);
  font-weight: 500;
}

/* 呼吸区 */
.breath {
  height: 34vh;
  min-height: 200px;
}

/* 节 */
.section {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--section-gap) var(--gutter) 0;
  scroll-margin-top: 24px;
}
.section-head {
  max-width: 40em;
}
.section-head h2 {
  margin: 0.4em 0 0;
  font-size: clamp(28px, 3.2vw, 40px);
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0.01em;
}
.lead {
  margin: 1em 0 0;
  color: var(--ink-65);
}
.block-label {
  margin: calc(var(--section-gap) * 0.7) 0 0;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--sea);
}

/* 工作台：非对称分数列 */
.ws-grid {
  display: grid;
  grid-template-columns: 1.5fr 1.1fr 0.9fr;
  gap: calc(var(--gutter) * 1.1);
  margin-top: calc(var(--section-gap) * 0.55);
}
.ws-cell {
  border-top: 1px solid var(--tide);
  padding-top: 1.1em;
}
.ws-index {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.18em;
  color: var(--sea);
}
.ws-icon {
  width: 20px;
  height: 20px;
  margin-top: 1.6em;
  color: var(--tide);
}
.ws-cell h3 {
  margin: 0.7em 0 0;
  font-size: clamp(18px, 1.4vw, 21px);
  font-weight: 500;
}
.ws-desc {
  margin: 0.5em 0 0;
  font-size: 14px;
  color: var(--ink-65);
}
.ws-points {
  margin: 1em 0 1.4em;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--ink-65);
  display: grid;
  gap: 0.45em;
}
.ws-points li {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
}
.ws-points svg {
  color: var(--sea);
  transform: translateY(1px);
}

/* 流程 */
.flow-grid {
  display: grid;
  grid-template-columns: 1.25fr 1fr 1.25fr 1fr;
  gap: calc(var(--gutter) * 1.1);
  margin: calc(var(--section-gap) * 0.55) 0 0;
  padding: 0;
  list-style: none;
}
.flow-cell {
  border-top: 1px solid var(--hairline);
  padding-top: 1.1em;
}
.flow-num {
  margin: 0;
  font-size: clamp(24px, 2.2vw, 32px);
  font-weight: 400;
  line-height: 1;
  color: var(--tide);
  font-variant-numeric: tabular-nums;
}
.flow-cell h3 {
  margin: 1.2em 0 0;
  font-size: clamp(16px, 1.2vw, 18px);
  font-weight: 500;
}
.flow-cell p:last-child {
  margin: 0.5em 0 0;
  font-size: 14px;
  color: var(--ink-65);
}

/* 数据 */
.src-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: calc(var(--gutter) * 1.1);
  margin-top: 1.4em;
}
.src-cell {
  border-top: 1px solid var(--tide);
  padding-top: 1em;
}
.src-route {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-45);
}
.src-cell h4 {
  margin: 0.8em 0 0;
  font-size: clamp(15px, 1.1vw, 17px);
  font-weight: 500;
  line-height: 1.4;
}
.src-cell p:last-child {
  margin: 0.6em 0 0;
  font-size: 13px;
  color: var(--ink-65);
}

.data-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: calc(var(--gutter) * 1.4);
  margin-top: calc(var(--section-gap) * 0.7);
}
.groups-list {
  margin: 1.2em 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 1.3em;
}
.groups-list li {
  border-top: 1px solid var(--hairline);
  padding-top: 0.9em;
}
.groups-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.groups-name {
  font-weight: 500;
  font-size: 15px;
}
.groups-count {
  font-size: 12px;
  color: var(--sea);
  font-variant-numeric: tabular-nums;
}
.groups-list p {
  margin: 0.3em 0 0;
  font-size: 13px;
  color: var(--ink-65);
}

.side-stack {
  display: flex;
  flex-direction: column;
}
.side-cell {
  border-top: 1px solid var(--tide);
  padding: 1.1em 0 1.4em;
}
.side-cell .block-label {
  margin: 0;
}
.side-body {
  margin: 0.7em 0 0;
  font-size: 13px;
  color: var(--ink-65);
}
.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
  margin-top: 0.9em;
}
.side-cell--rule {
  border-top: 2px solid var(--tide);
}
.transform-line {
  margin: 0.8em 0 0;
  font-size: clamp(17px, 1.5vw, 20px);
  font-weight: 500;
  line-height: 1.4;
}

/* 主张 */
.values-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1.3fr;
  gap: calc(var(--gutter) * 1.1);
}
.value-cell {
  border-top: 1px solid var(--tide);
  padding-top: 1.1em;
}
.value-cell h3 {
  margin: 1em 0 0;
  font-size: clamp(16px, 1.3vw, 19px);
  font-weight: 500;
}
.value-cell p:last-child {
  margin: 0.5em 0 0;
  font-size: 14px;
  color: var(--ink-65);
}

/* CTA */
.cta {
  padding-bottom: 0;
}
.cta-title {
  max-width: 18em;
  margin: 0;
  font-size: clamp(30px, 3.6vw, 52px);
  font-weight: 500;
  line-height: 1.18;
  text-wrap: balance;
}
.cta-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1.8em;
  margin-top: 2em;
}

/* 页脚 */
.foot {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1.1fr;
  gap: calc(var(--gutter) * 1.1);
  max-width: 1180px;
  margin: var(--section-gap) auto 0;
  padding: 2.2em var(--gutter) 3em;
  border-top: 1px solid var(--hairline);
  font-size: 13px;
  color: var(--ink-45);
}
.foot-brand p {
  margin: 0.6em 0 0;
}
.foot-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em 1.4em;
  align-content: start;
}
.foot-tag {
  margin: 0;
  text-align: right;
}

/* 移动端锚点排：默认隐藏，<1024px 显示 */
.mobile-nav {
  display: none;
}

/* ============ 开场动效（仅首访） ============ */
.scroll--intro .rail::after {
  animation: bar-grow 1s var(--ease) 0.05s both;
  transform: scaleY(0);
}
.scroll--intro .rail-title-ch {
  opacity: 0;
  animation: ch-in 0.7s var(--ease) both;
  animation-delay: calc(1.05s + var(--i) * 50ms);
}
@keyframes bar-grow {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}
@keyframes ch-in {
  from {
    opacity: 0;
    transform: scale(1.25);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scroll--intro .rail::after,
  .scroll--intro .rail-title-ch {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .lnk {
    transition: none;
  }
}

/* ============ 移动端（<1024px）：竖轨收为顶部横条 ============ */
@media (max-width: 1023.98px) {
  .rail {
    position: static;
    width: auto;
    flex-direction: row;
    align-items: center;
    gap: 1em;
    padding: 0.9em var(--gutter);
  }
  .rail::after {
    top: auto;
    right: 0;
    bottom: -10px;
    left: 0;
    width: auto;
    height: 10px;
    transform: scaleX(1);
    transform-origin: left;
  }
  .scroll--intro .rail::after {
    animation-name: bar-grow-x;
  }
  .rail-title {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0.2em;
    gap: 0.25em;
  }
  .rail-title--v {
    writing-mode: horizontal-tb;
  }
  .rail-nav {
    display: none;
  }
  .rail-foot {
    margin: 0 0 0 auto;
  }
  .lnk--foot {
    display: none;
  }

  .sheet {
    margin-left: 0;
  }

  .hero-stretch {
    height: auto;
  }
  .hero {
    position: relative;
    min-height: 0;
    padding-top: calc(var(--gutter) * 1.6);
    padding-bottom: calc(var(--gutter) * 1.6);
  }
  .hero-tide {
    height: 30%;
    opacity: 0.7;
  }
  .hero-inner {
    grid-template-columns: 1fr;
    gap: calc(var(--gutter) * 1.2);
  }
  .hero-hint {
    display: none;
  }

  .breath {
    height: 17vh;
    min-height: 110px;
  }

  .ws-grid,
  .src-grid,
  .values-grid,
  .data-grid,
  .foot {
    grid-template-columns: 1fr;
  }
  .flow-grid {
    grid-template-columns: 1fr 1fr;
  }
  .foot-tag {
    text-align: left;
  }

  .mobile-nav {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4em 1.3em;
    padding: 0.8em var(--gutter);
    background: color-mix(in srgb, var(--paper) 92%, transparent);
    border-top: 1px solid var(--hairline);
    font-size: 13px;
  }
}

@media (max-width: 640px) {
  .flow-grid {
    grid-template-columns: 1fr;
  }
  .hide-sm {
    display: none;
  }
}

@keyframes bar-grow-x {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
</style>
