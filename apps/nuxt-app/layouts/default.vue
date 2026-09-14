<template>
  <div class="kcs-desk">
    <header class="kcs-top">
      <NuxtLink :to="localePath('/')" class="kcs-brand">
        <strong>{{ t('kcs.brand.title') }}</strong>
        <span>{{ t('kcs.brand.runLabel') }}</span>
      </NuxtLink>

      <nav class="kcs-nav" :aria-label="t('kcs.brand.short')">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="localePath(item.to)"
          :class="{ 'is-active': isActive(item.to) }"
        >
          {{ t(item.label) }}
        </NuxtLink>
      </nav>

      <div class="kcs-tools">
        <div class="kcs-seg" role="group" data-testid="locale-switch" :aria-label="t('kcs.toolbar.language')">
          <button
            v-for="item in localeButtons"
            :key="item.code"
            type="button"
            :aria-pressed="locale === item.code"
            @click="changeLanguage(item.code)"
          >
            {{ item.name }}
          </button>
        </div>
        <div class="kcs-seg" role="group" data-testid="theme-toggle" :aria-label="t('kcs.toolbar.theme')">
          <button
            v-for="item in themeButtons"
            :key="item.value"
            type="button"
            :aria-pressed="preference === item.value"
            @click="setPreference(item.value)"
          >
            {{ t(item.label) }}
          </button>
        </div>
      </div>
    </header>
    <main class="kcs-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import type { ThemePreference } from '../composables/useKcsTheme'

const { t, locale, locales } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const route = useRoute()
const { preference, setPreference } = useKcsTheme()

const nav = [
  { to: '/', label: 'kcs.nav.overview' },
  { to: '/creators', label: 'kcs.nav.creators' },
  { to: '/reviews', label: 'kcs.nav.reviews' },
] as const

const localeButtons = computed(() =>
  locales.value.map(item => ({
    code: String(item.code),
    name: item.name || String(item.code),
  })),
)

const themeButtons: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'kcs.toolbar.themeLight' },
  { value: 'dark', label: 'kcs.toolbar.themeDark' },
  { value: 'system', label: 'kcs.toolbar.themeSystem' },
]

const isActive = (to: string) => {
  const path = route.path.replace(/^\/(zh-CN|en|ko)/, '') || '/'
  return to === '/' ? path === '/' : path.startsWith(to)
}

const changeLanguage = (target: string) => {
  const path = switchLocalePath(target as 'en' | 'zh-CN' | 'ko')
  if (path) {
    navigateTo(path)
  }
}

useHead({
  title: () => t('kcs.brand.title'),
  htmlAttrs: { lang: locale },
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,600&display=swap',
    },
    {
      rel: 'stylesheet',
      href: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/woff2/SUIT.css',
    },
  ],
})
</script>
