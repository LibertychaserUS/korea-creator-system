<template>
  <main class="abyss">
    <!-- 声纳坐标纸：全页 1px 细网格底纹 -->
    <div class="grid-paper" aria-hidden="true" />

    <!-- 顶部驾驶舱导航：吸顶，透明 → 深海墨 + 毛玻璃 -->
    <header class="topbar" :class="{ 'topbar--stuck': stuck }">
      <div class="topbar-inner">
        <NuxtLink :to="localePath('/')" class="topbar-brand">
          <AppLogo size="sm" />
          <span class="topbar-tag">{{ t('kcs.brand.tagline') }}</span>
        </NuxtLink>

        <nav class="topbar-nav" aria-label="sections">
          <a v-for="item in railNav" :key="item.href" :href="item.href" class="path">{{ item.path }}</a>
        </nav>

        <div class="topbar-side">
          <LocaleSelect />
          <ThemeToggle />
          <NuxtLink
            :to="localePath('/login')"
            class="path path--cta"
            data-testid="cta-enter"
            :aria-label="t('kcs.panel.signIn')"
          >
            <span
              v-for="(ch, i) in loginPath.split('')"
              :key="i"
              class="path-ch"
              :style="{ '--d': `${i * 20}ms` }"
            >{{ ch }}</span>
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- Hero：深海驾驶舱主屏 -->
    <section class="hero" data-testid="marketing-hero">
      <AbyssField class="hero-field" :seed="3" />
      <TideCanvas class="hero-ripples" aria-hidden="true" />

      <div class="hero-inner">
        <div class="hero-copy">
          <p class="fn"><span class="fn-call">pool.query()</span><span class="fn-caret" aria-hidden="true" /></p>
          <h1 class="hero-title">
            {{ t('kcs.landing.heroTitlePre') }}<span class="tok">creatorData()</span>{{ t('kcs.landing.heroTitlePost') }}
          </h1>
          <p class="hero-story">{{ t('kcs.brand.story') }}</p>
          <div class="hero-cta">
            <NuxtLink :to="localePath('/login')" class="btn-sonar" data-testid="cta-enter-hero">
              <span
                v-for="(ch, i) in loginPath.split('')"
                :key="i"
                class="path-ch"
                :style="{ '--d': `${i * 20}ms` }"
              >{{ ch }}</span>
            </NuxtLink>
            <a href="mailto:admin@kcs.local" class="path" data-testid="cta-request">/request-access</a>
          </div>
          <p class="hero-pillars">{{ t('kcs.brand.pillars') }}</p>
        </div>

        <!-- 数据预览面板：声纳终端风格的达人池缩影 -->
        <div class="specimen" aria-label="product preview">
          <div class="specimen-head">
            <p class="specimen-title"><span class="fn-call fn-call--sm">pool.list()</span></p>
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
            <span class="specimen-assign">{{ t('kcs.actions.assign') }} →</span>
          </div>
        </div>
      </div>

      <p class="hero-hint" aria-hidden="true">{{ t('kcs.landing.scrollHint') }}</p>
    </section>

    <!-- 节间呼吸区：半幅深海粒子 -->
    <div class="breath" aria-hidden="true"><AbyssField :seed="11" :opacity="0.55" /></div>

    <!-- 三端工作台 -->
    <section id="workspaces" class="section">
      <header class="section-head">
        <p class="fn"><span class="fn-call">brief.create()</span><span class="fn-caret" aria-hidden="true" /></p>
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
          <a :href="ws.url" class="path" :data-testid="`cta-${ws.key}`">{{ ws.path }}</a>
        </article>
      </div>
    </section>

    <!-- 流程 -->
    <section id="flow" class="section">
      <header class="section-head">
        <p class="fn"><span class="fn-call">mission.compare()</span><span class="fn-caret" aria-hidden="true" /></p>
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

    <div class="breath" aria-hidden="true"><AbyssField :seed="29" :opacity="0.45" /></div>

    <!-- 数据 -->
    <section id="data" class="section" data-testid="marketing-data">
      <header class="section-head">
        <p class="fn"><span class="fn-call">ingest.schedule()</span><span class="fn-caret" aria-hidden="true" /></p>
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
      <header class="section-head">
        <p class="fn"><span class="fn-call">export.proposal()</span><span class="fn-caret" aria-hidden="true" /></p>
      </header>
      <div class="values-grid">
        <div v-for="(v, i) in values" :key="i" class="value-cell">
          <p class="ws-index">0{{ i + 1 }}</p>
          <h3>{{ rt(v.title) }}</h3>
          <p>{{ rt(v.body) }}</p>
        </div>
      </div>
    </section>

    <div class="breath" aria-hidden="true"><AbyssField :seed="47" :opacity="0.4" /></div>

    <!-- CTA -->
    <section class="section cta">
      <p class="fn"><span class="fn-call">pool.open()</span><span class="fn-caret" aria-hidden="true" /></p>
      <h2 class="cta-title">{{ t('kcs.landing.ctaTitle') }}</h2>
      <p class="lead">{{ t('kcs.landing.ctaLead') }}</p>
      <div class="cta-links">
        <NuxtLink :to="localePath('/login')" class="btn-sonar" data-testid="cta-enter-bottom">
          <span
            v-for="(ch, i) in loginPath.split('')"
            :key="i"
            class="path-ch"
            :style="{ '--d': `${i * 20}ms` }"
          >{{ ch }}</span>
        </NuxtLink>
        <a href="mailto:admin@kcs.local" class="path" data-testid="cta-request-bottom">/request-access</a>
      </div>
    </section>

    <footer class="foot">
      <div class="foot-brand">
        <AppLogo size="sm" />
        <p>{{ t('kcs.landing.footerNote') }}</p>
      </div>
      <nav class="foot-nav" :aria-label="t('kcs.landing.footerLinks')">
        <a v-for="ws in workspaces" :key="ws.key" :href="ws.url" class="path">{{ ws.path }}</a>
        <NuxtLink :to="localePath('/login')" class="path">{{ loginPath }}</NuxtLink>
      </nav>
      <p class="foot-tag">{{ t('kcs.landing.footerTagline') }}</p>
    </footer>

    <!-- 移动端锚点排 -->
    <nav class="mobile-nav" aria-label="sections">
      <a v-for="item in railNav" :key="item.href" :href="item.href" class="path">{{ item.path }}</a>
    </nav>
  </main>
</template>

<script setup lang="ts">
// 听潮 · 宣传页「ABYSS · 深海驾驶舱」：把数据查询语法变成视觉语言。
// 等宽函数调用眉题 + 路径式导航 + 海洋雪粒子场；对外门面，无工作台侧栏。
import { Activity, Check, ClipboardList, ShieldCheck, Users } from 'lucide-vue-next'
import { CREATOR_TIERS, SOURCE_IDS, SOURCE_ROUTE, type CreatorTier } from '@kcs/contract'

definePageMeta({ layout: false })

const { t, tm, rt, locale } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()

// 路径式文案（代码路径不翻译，三语一致）
const loginPath = '/login'

// 顶部导航吸顶：滚过 8px 后背景从透明过渡到深海墨 + 毛玻璃
const stuck = ref(false)
let onScroll: (() => void) | null = null
onMounted(() => {
  const sync = () => {
    stuck.value = window.scrollY > 8
  }
  let raf = 0
  onScroll = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      sync()
    })
  }
  sync()
  window.addEventListener('scroll', onScroll, { passive: true })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll!)
    if (raf) cancelAnimationFrame(raf)
  })
})

const railNav = [
  { href: '#workspaces', path: '/desks', label: 'kcs.landing.navWorkspaces' },
  { href: '#flow', path: '/flow', label: 'kcs.landing.navFlow' },
  { href: '#data', path: '/data', label: 'kcs.landing.navScoring' },
  { href: '#values', path: '/values', label: 'kcs.landing.navValues' },
]

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
    path: '/select',
    icon: Users,
    points: ['kcs.panel.pool', 'kcs.panel.projects', 'kcs.panel.assign'],
  },
  {
    key: 'ops',
    label: 'kcs.nav.ops',
    desc: 'kcs.panel.opsDesc',
    cta: 'kcs.panel.openOps',
    url: `${config.public.opsUrl}/${locale.value}/`,
    path: '/ops',
    icon: ClipboardList,
    points: ['kcs.panel.createCreator', 'kcs.panel.review', 'kcs.panel.publish'],
  },
  {
    key: 'dev',
    label: 'kcs.nav.monitor',
    desc: 'kcs.panel.devDesc',
    cta: 'kcs.panel.openDev',
    url: `${config.public.devUrl}/${locale.value}/`,
    path: '/dev',
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
.abyss {
  --abyss: #050a12;
  --ink: #e6edf3;
  --ink-65: rgba(230, 237, 243, 0.65);
  --ink-45: rgba(230, 237, 243, 0.45);
  --sonar: #39d0d8;
  --sonar-70: rgba(57, 208, 216, 0.7);
  --sonar-40: rgba(57, 208, 216, 0.4);
  --sonar-12: rgba(57, 208, 216, 0.12);
  --sea: #2f5f8f;
  --hairline: rgba(230, 237, 243, 0.09);
  --card-line: rgba(230, 237, 243, 0.06);
  --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --gutter: clamp(20px, 4vw, 56px);
  --section-gap: clamp(72px, 10vw, 128px);
  --maxw: 1180px;
  --ease: cubic-bezier(0.33, 0, 0.66, 1);

  position: relative;
  min-height: 100vh;
  background: var(--abyss);
  color: var(--ink);
  font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif;
  font-size: clamp(15px, 0.6vw + 12px, 16px);
  line-height: 1.7;
  overflow-x: clip;
}

::selection {
  background: rgba(57, 208, 216, 0.3);
  color: #ffffff;
}

/* 自定义滚动条：6px 青色拇指 */
:global(html) {
  scrollbar-width: thin;
  scrollbar-color: var(--sonar) transparent;
  scroll-behavior: smooth;
}
:global(::-webkit-scrollbar) {
  width: 6px;
  height: 6px;
}
:global(::-webkit-scrollbar-thumb) {
  background: var(--sonar-70);
  border-radius: 3px;
}
:global(::-webkit-scrollbar-track) {
  background: transparent;
}

/* 声纳坐标纸：全页 1px 细网格 */
.grid-paper {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(230, 237, 243, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(230, 237, 243, 0.04) 1px, transparent 1px);
  background-size: 48px 48px;
}

/* ============ 函数调用式眉题 ============ */
.fn {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin: 0;
  font-family: var(--mono);
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--sonar);
}
.fn-call {
  color: var(--sonar);
}
.fn-call--sm {
  font-size: 12px;
}
/* 半透光标方块：1s 步进闪烁 */
.fn-caret {
  width: 0.55em;
  height: 1.05em;
  background: var(--sonar-70);
  animation: caret-blink 1s steps(1) infinite;
}
@keyframes caret-blink {
  0%, 55% { opacity: 1; }
  56%, 100% { opacity: 0.18; }
}

/* 语法高亮 token：等宽 + 青色 + 圆角底块 */
.tok {
  display: inline-block;
  margin: 0 0.12em;
  padding: 0.02em 0.22em 0.06em;
  font-family: var(--mono);
  font-weight: 600;
  font-size: 0.82em;
  letter-spacing: 0;
  color: var(--sonar);
  background: var(--sonar-12);
  border: 1px solid var(--sonar-40);
  border-radius: 0.18em;
  transform: translateY(-0.04em);
  white-space: nowrap;
}

/* ============ 路径式链接 & 按钮 ============ */
.path {
  font-family: var(--mono);
  font-size: 13px;
  letter-spacing: 0.02em;
  color: var(--ink-65);
  text-decoration: none;
  transition: color 0.2s var(--ease);
  cursor: pointer;
}
.path:hover,
.path:focus-visible {
  color: var(--sonar);
}

/* /login 逐字符声纳扫过 */
.path-ch {
  transition: color 0.18s var(--ease);
  transition-delay: var(--d, 0ms);
}
.path--cta,
.btn-sonar {
  color: var(--ink);
}
.path--cta:hover .path-ch,
.path--cta:focus-visible .path-ch,
.btn-sonar:hover .path-ch,
.btn-sonar:focus-visible .path-ch {
  color: var(--sonar);
}

/* 主 CTA：声纳框按钮 */
.btn-sonar {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  padding: 0.55em 1.1em;
  font-family: var(--mono);
  font-size: clamp(15px, 1vw + 11px, 17px);
  text-decoration: none;
  color: var(--ink);
  border: 1px solid var(--sonar-40);
  border-radius: 4px;
  background: var(--sonar-12);
  transition: border-color 0.25s var(--ease), box-shadow 0.25s var(--ease), background 0.25s var(--ease);
}
.btn-sonar:hover,
.btn-sonar:focus-visible {
  border-color: var(--sonar);
  box-shadow: 0 0 18px rgba(57, 208, 216, 0.18), inset 0 0 12px rgba(57, 208, 216, 0.06);
  background: rgba(57, 208, 216, 0.16);
}

/* ============ 顶部导航 ============ */
.topbar {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 40;
  transition: background 0.3s var(--ease), border-color 0.3s var(--ease), backdrop-filter 0.3s var(--ease);
  border-bottom: 1px solid transparent;
}
.topbar--stuck {
  background: rgba(5, 10, 18, 0.85);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border-bottom-color: var(--hairline);
}
.topbar-inner {
  display: flex;
  align-items: center;
  gap: clamp(1em, 3vw, 2.4em);
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 0.8em var(--gutter);
}
.topbar-brand {
  display: flex;
  align-items: center;
  gap: 0.8em;
  text-decoration: none;
}
.topbar-tag {
  font-size: 12px;
  color: var(--ink-45);
  white-space: nowrap;
}
.topbar-nav {
  display: flex;
  gap: 1.6em;
  margin-left: auto;
}
.topbar-side {
  display: flex;
  align-items: center;
  gap: 1em;
}
.topbar-side :deep(button) {
  background: transparent;
  border: none;
  box-shadow: none;
  color: var(--ink-65);
  height: auto;
  padding: 0.2em 0.3em;
}
.topbar-side :deep(button:hover) {
  background: transparent;
  color: var(--sonar);
}

/* ============ Hero ============ */
.hero {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100svh;
  overflow: hidden;
  padding: calc(var(--gutter) * 1.6) var(--gutter) calc(var(--gutter) * 1.4);
}
.hero-field {
  position: absolute;
  inset: 0;
}
.hero-ripples {
  position: absolute;
  inset: 0;
  opacity: 0.35;
  pointer-events: none;
}
/* 底部极淡的径向青光晕（伪元素，禁大面积糊屏） */
.hero::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -12%;
  width: min(720px, 80vw);
  height: 320px;
  transform: translateX(-50%);
  background: radial-gradient(closest-side, rgba(57, 208, 216, 0.07), transparent 72%);
  pointer-events: none;
}

.hero-inner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: calc(var(--gutter) * 1.4);
  align-items: center;
  max-width: var(--maxw);
  margin: 0 auto;
  width: 100%;
}

.hero-title {
  margin: 0.4em 0 0;
  font-size: clamp(44px, 6vw, 88px);
  font-weight: 800;
  line-height: 1.12;
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
  align-items: center;
  gap: 1.6em;
  margin-top: 2.2em;
}
.hero-pillars {
  margin: 2.6em 0 0;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--ink-45);
}
.hero-hint {
  position: absolute;
  right: var(--gutter);
  bottom: calc(var(--gutter) * 0.7);
  margin: 0;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--ink-45);
  writing-mode: vertical-rl;
}

/* 数据预览面板：声纳终端线框 */
.specimen {
  position: relative;
  border: 1px solid var(--card-line);
  border-radius: 6px;
  background: rgba(5, 10, 18, 0.6);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}
.specimen::before {
  content: "";
  position: absolute;
  inset: -1px -1px auto -1px;
  height: 2px;
  border-radius: 6px 6px 0 0;
  background: linear-gradient(90deg, transparent, var(--sonar-40), transparent);
}
.specimen-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1em;
  padding: 0.9em 1.2em;
  border-bottom: 1px solid var(--hairline);
}
.specimen-title {
  margin: 0;
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
  padding: 0.6em 1.2em;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-45);
  border-bottom: 1px solid var(--hairline);
  font-variant-numeric: tabular-nums;
}
.specimen-table td {
  padding: 0.7em 1.2em;
  border-bottom: 1px solid var(--hairline);
  vertical-align: middle;
  transition: background 0.2s var(--ease);
}
.specimen-table tbody tr {
  transition: box-shadow 0.2s var(--ease);
}
/* 行 hover：整行 0.04 青 + 左侧 2px 青条 */
.specimen-table tbody tr:hover {
  background: rgba(57, 208, 216, 0.04);
  box-shadow: inset 2px 0 0 var(--sonar);
}
.specimen-name {
  margin: 0;
  font-weight: 500;
  line-height: 1.3;
}
.specimen-tags {
  margin: 0.15em 0 0;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-45);
}
.num {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.num--top {
  color: var(--sonar);
}
.num--dim {
  color: var(--ink-45);
  font-weight: 400;
}
.specimen-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8em 1.2em;
  font-size: 12px;
  color: var(--ink-65);
}
.specimen-assign {
  font-family: var(--mono);
  color: var(--sonar);
}

/* 呼吸区 */
.breath {
  position: relative;
  z-index: 1;
  height: 30vh;
  min-height: 160px;
}

/* 节 */
.section {
  position: relative;
  z-index: 1;
  max-width: var(--maxw);
  margin: 0 auto;
  padding: var(--section-gap) var(--gutter) 0;
  scroll-margin-top: 72px;
}
/* 节首极淡径向青光晕 */
.section-head {
  position: relative;
  max-width: 40em;
}
.section-head::before {
  content: "";
  position: absolute;
  top: -40px;
  left: -60px;
  width: 380px;
  height: 220px;
  background: radial-gradient(closest-side, rgba(57, 208, 216, 0.055), transparent 70%);
  pointer-events: none;
}
.section-head h2 {
  margin: 0.5em 0 0;
  font-size: clamp(28px, 3.4vw, 44px);
  font-weight: 800;
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
  color: var(--sonar);
}

/* 三端功能卡：0.06 透明细边框，hover 三阶段错峰 */
.ws-grid {
  display: grid;
  grid-template-columns: 1.5fr 1.1fr 0.9fr;
  gap: clamp(14px, 2vw, 24px);
  margin-top: calc(var(--section-gap) * 0.55);
}
.ws-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--card-line);
  border-radius: 6px;
  padding: 1.4em 1.4em 1.5em;
  background: rgba(230, 237, 243, 0.015);
  transition:
    transform 0.3s var(--ease) 0.1s,
    border-color 0.25s var(--ease) 0.05s,
    box-shadow 0.2s var(--ease);
}
/* 顶部 2px 青线：0.2s 先出现 */
.ws-cell::before {
  content: "";
  position: absolute;
  inset: -1px -1px auto -1px;
  height: 2px;
  border-radius: 6px 6px 0 0;
  background: var(--sonar);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.2s var(--ease);
}
.ws-cell:hover {
  transform: translateY(-4px);
  border-color: var(--sonar-40);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.35), 0 0 24px rgba(57, 208, 216, 0.07);
}
.ws-cell:hover::before {
  transform: scaleX(1);
}
.ws-index {
  margin: 0;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.18em;
  color: var(--sonar-70);
  font-variant-numeric: tabular-nums;
}
.ws-icon {
  width: 20px;
  height: 20px;
  margin-top: 1.4em;
  color: var(--sonar);
}
.ws-cell h3 {
  margin: 0.7em 0 0;
  font-size: clamp(18px, 1.4vw, 21px);
  font-weight: 700;
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
  color: var(--sonar);
  transform: translateY(1px);
}
.ws-cell .path {
  margin-top: auto;
}

/* 流程 */
.flow-grid {
  display: grid;
  grid-template-columns: 1.25fr 1fr 1.25fr 1fr;
  gap: clamp(14px, 2vw, 24px);
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
  font-family: var(--mono);
  font-size: clamp(24px, 2.2vw, 32px);
  font-weight: 400;
  line-height: 1;
  color: var(--sonar);
  font-variant-numeric: tabular-nums;
}
.flow-cell h3 {
  margin: 1.2em 0 0;
  font-size: clamp(16px, 1.2vw, 18px);
  font-weight: 700;
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
  gap: clamp(14px, 2vw, 24px);
  margin-top: 1.4em;
}
.src-cell {
  border: 1px solid var(--card-line);
  border-radius: 6px;
  padding: 1.2em 1.3em;
  background: rgba(230, 237, 243, 0.015);
  transition: border-color 0.25s var(--ease);
}
.src-cell:hover {
  border-color: var(--sonar-40);
}
.src-route {
  margin: 0;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-45);
}
.src-cell h4 {
  margin: 0.8em 0 0;
  font-size: clamp(15px, 1.1vw, 17px);
  font-weight: 700;
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
  font-weight: 600;
  font-size: 15px;
}
.groups-count {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--sonar);
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
  border-top: 1px solid var(--hairline);
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
  border-top: 2px solid var(--sonar-40);
}
.transform-line {
  margin: 0.8em 0 0;
  font-size: clamp(17px, 1.5vw, 20px);
  font-weight: 700;
  line-height: 1.4;
}

/* 主张 */
.values-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1.3fr;
  gap: clamp(14px, 2vw, 24px);
}
.value-cell {
  border-top: 1px solid var(--hairline);
  padding-top: 1.1em;
}
.value-cell h3 {
  margin: 1em 0 0;
  font-size: clamp(16px, 1.3vw, 19px);
  font-weight: 700;
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
.cta::before {
  content: "";
  position: absolute;
  top: calc(var(--section-gap) * 0.5);
  left: 50%;
  width: min(640px, 76vw);
  height: 300px;
  transform: translateX(-50%);
  background: radial-gradient(closest-side, rgba(57, 208, 216, 0.06), transparent 72%);
  pointer-events: none;
}
.cta-title {
  position: relative;
  max-width: 18em;
  margin: 0.4em 0 0;
  font-size: clamp(30px, 3.8vw, 54px);
  font-weight: 800;
  line-height: 1.18;
  text-wrap: balance;
}
.cta .lead,
.cta-links {
  position: relative;
}
.cta-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.8em;
  margin-top: 2em;
}

/* 页脚 */
.foot {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1.2fr 1fr 1.1fr;
  gap: calc(var(--gutter) * 1.1);
  max-width: var(--maxw);
  margin: var(--section-gap) auto 0;
  padding: 2.2em var(--gutter) 7em;
  border-top: 1px solid var(--hairline);
  font-size: 13px;
  color: rgba(230, 237, 243, 0.55);
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

/* 移动端锚点排 */
.mobile-nav {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 40;
  display: none;
  gap: 1.2em;
  padding: 0.7em var(--gutter) calc(0.7em + env(safe-area-inset-bottom));
  background: rgba(5, 10, 18, 0.85);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--hairline);
  overflow-x: auto;
}

/* ============ 响应式 ============ */
@media (max-width: 1023px) {
  .hero-inner {
    grid-template-columns: 1fr;
    gap: calc(var(--gutter) * 1.1);
  }
  .specimen {
    max-width: 560px;
  }
  .ws-grid,
  .flow-grid,
  .src-grid,
  .values-grid {
    grid-template-columns: 1fr;
  }
  .data-grid {
    grid-template-columns: 1fr;
  }
  .foot {
    grid-template-columns: 1fr;
    padding-bottom: 8em;
  }
  .foot-tag {
    text-align: left;
  }
}

@media (max-width: 767px) {
  /* 网格密度减半 */
  .grid-paper {
    background-size: 96px 96px;
  }
  .topbar-nav {
    display: none;
  }
  .topbar-tag {
    display: none;
  }
  .mobile-nav {
    display: flex;
  }
  .hero {
    padding-top: calc(var(--gutter) * 2.2);
  }
  .hero-title {
    font-size: clamp(34px, 9.5vw, 44px);
  }
  .hide-sm {
    display: none;
  }
  .hero-hint {
    display: none;
  }
  .breath {
    height: 18vh;
    min-height: 110px;
  }
}
</style>
