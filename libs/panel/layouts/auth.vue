<template>
  <main class="tide-auth relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden p-6 md:p-10">
    <!-- Warm animated tide background: CSS fog swells + ripple/breath canvas -->
    <div class="tide-bg" aria-hidden="true">
      <div class="tide-swell tide-swell--warm" />
      <div class="tide-swell tide-swell--sea" />
      <div class="tide-swell tide-swell--sand" />
      <div class="tide-shore" />
      <TideCanvas />
    </div>

    <div class="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-md border border-border bg-background/80 p-1 backdrop-blur-sm">
      <LocaleSelect />
      <ThemeToggle />
    </div>
    <div class="relative z-10 flex w-full max-w-sm flex-col gap-6">
      <div class="flex flex-col items-center gap-3">
        <NuxtLink :to="localePath('/')" class="self-center">
          <AppLogo size="md" />
        </NuxtLink>
        <div class="tide-intro flex flex-col items-center gap-2 text-center">
          <p class="tide-line text-sm text-muted-foreground" style="--line: 0">
            {{ t('kcs.brand.storyExcerpt') }}
          </p>
          <p class="tide-line text-base font-medium text-foreground" style="--line: 1">
            {{ t('kcs.brand.tagline') }}
          </p>
        </div>
      </div>
      <slot />
    </div>
  </main>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()

useHead({
  title: () => t('kcs.brand.title'),
  htmlAttrs: { lang: locale },
})
</script>

<style scoped>
/*
 * Warm tide background — slow drifting swells over a warm paper base.
 * Restrained, editorial, Apple-style motion: long durations, low opacity,
 * heavy blur. Disabled under prefers-reduced-motion.
 */
.tide-auth {
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
  background: linear-gradient(
    to top,
    oklch(0.86 0.04 215 / 0.28) 0%,
    transparent 100%
  );
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

/*
 * 深色：scoped 样式里 `:global(.dark) .x` 会被编译成裸 `.dark`（后半段被丢掉），
 * 整个选择器必须放进 :global() 里，否则暗色下背景仍是浅色、白字不可读。
 */
:global(.dark .tide-auth) {
  background: linear-gradient(
    168deg,
    oklch(0.2 0.014 70) 0%,
    oklch(0.18 0.012 200) 45%,
    oklch(0.17 0.018 250) 100%
  );
}

:global(.dark .tide-auth .tide-swell--warm) {
  background: radial-gradient(circle, oklch(0.5 0.08 70 / 0.28) 0%, transparent 65%);
}

:global(.dark .tide-auth .tide-swell--sea) {
  background: radial-gradient(circle, oklch(0.45 0.07 230 / 0.3) 0%, transparent 65%);
}

:global(.dark .tide-auth .tide-swell--sand) {
  background: radial-gradient(circle, oklch(0.48 0.05 90 / 0.22) 0%, transparent 65%);
}

:global(.dark .tide-auth .tide-shore) {
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
