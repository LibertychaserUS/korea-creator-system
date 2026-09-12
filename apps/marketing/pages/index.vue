<template>
  <main class="tide-landing relative min-h-svh overflow-hidden">
    <!-- Same warm tide as the login screen: fog swells + ripple canvas -->
    <div class="tide-bg" aria-hidden="true">
      <div class="tide-swell tide-swell--warm" />
      <div class="tide-swell tide-swell--sea" />
      <div class="tide-swell tide-swell--sand" />
      <div class="tide-shore" />
      <TideCanvas />
    </div>

    <header class="relative z-10 flex items-center justify-between px-6 py-4 md:px-10">
      <AppLogo size="md" />
      <div class="flex items-center gap-2 rounded-md border border-border bg-background/80 p-1 backdrop-blur-sm">
        <LocaleSelect />
        <ThemeToggle />
      </div>
    </header>

    <section
      class="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pb-16 pt-14 text-center md:pt-24"
      data-testid="marketing-hero"
    >
      <p class="tide-line text-sm text-muted-foreground" style="--line: 0">
        {{ t('kcs.brand.storyExcerpt') }}
      </p>
      <h1 class="tide-line text-4xl font-semibold tracking-tight text-foreground md:text-5xl" style="--line: 1">
        {{ t('kcs.brand.tagline') }}
      </h1>
      <p class="tide-line max-w-xl text-base leading-relaxed text-muted-foreground" style="--line: 2">
        {{ t('kcs.brand.story') }}
      </p>
      <p class="tide-line text-sm font-medium text-foreground" style="--line: 3">
        {{ t('kcs.brand.runLabel') }}
      </p>
      <div class="tide-line mt-2 flex flex-wrap items-center justify-center gap-3" style="--line: 4">
        <Button as-child size="lg" data-testid="cta-enter">
          <NuxtLink :to="localePath('/login')">{{ t('kcs.panel.signIn') }}</NuxtLink>
        </Button>
      </div>
    </section>

    <section class="relative z-10 mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-6 pb-20 md:grid-cols-3">
      <Card
        v-for="ws in workspaces"
        :key="ws.key"
        class="border-border/60 bg-card/80 backdrop-blur-sm transition-colors hover:border-border"
      >
        <CardHeader>
          <CardTitle class="text-lg">{{ t(ws.label) }}</CardTitle>
          <CardDescription>{{ t(ws.desc) }}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button as-child variant="outline" size="sm" :data-testid="`cta-${ws.key}`">
            <a :href="ws.url">{{ t(ws.cta) }}</a>
          </Button>
        </CardContent>
      </Card>
    </section>

    <footer class="relative z-10 px-6 pb-8 text-center text-xs text-muted-foreground">
      <p>{{ t('kcs.panel.homeLead') }}</p>
    </footer>
  </main>
</template>

<script setup lang="ts">
// 听潮 · 宣传页：公开落地页，无工作台侧栏；语言/主题与登录页同一套潮声。
definePageMeta({ layout: false })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()

const workspaces = computed(() => [
  {
    key: 'select',
    label: 'kcs.nav.select',
    desc: 'kcs.panel.selectDesc',
    cta: 'kcs.panel.openSelect',
    url: config.public.selectUrl as string,
  },
  {
    key: 'ops',
    label: 'kcs.nav.ops',
    desc: 'kcs.panel.opsDesc',
    cta: 'kcs.panel.openOps',
    url: config.public.opsUrl as string,
  },
  {
    key: 'dev',
    label: 'kcs.nav.monitor',
    desc: 'kcs.panel.devDesc',
    cta: 'kcs.panel.openDev',
    url: config.public.devUrl as string,
  },
])

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

/* Opening lines rise in with the tide — staggered, calm, no layout shift. */
.tide-line {
  opacity: 0;
  transform: translateY(10px);
  animation: tide-line-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(0.35s + var(--line, 0) * 0.55s);
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
