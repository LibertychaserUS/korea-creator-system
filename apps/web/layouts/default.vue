<template>
  <div class="shell">
    <aside class="rail">
      <strong>{{ t('brand') }}</strong>
      <NuxtLink
        v-for="item in items"
        :key="item.id"
        :to="localePath(item.href)"
        :data-testid="`nav-${item.id}`"
        :class="{ active: route.path.includes(item.href) }"
      >
        {{ t(item.id) }}
      </NuxtLink>
    </aside>
    <div class="main">
      <header class="top">
        <div data-testid="auth-session" :data-role="user?.role || undefined">
          <span class="muted">{{ user?.displayName }} {{ user?.role }}</span>
        </div>
        <div class="chrome">
          <ClientOnly>
            <div data-testid="locale-switch">
              <button class="btn ghost" type="button" @click="setLocale('en')">English</button>
              <button class="btn ghost" type="button" @click="setLocale('ko')">한국어</button>
              <button class="btn ghost" type="button" @click="setLocale('zh-CN')">中文</button>
            </div>
            <div data-testid="theme-toggle">
              <button class="btn ghost" type="button" @click="setTheme('dark')">深色</button>
              <button class="btn ghost" type="button" @click="setTheme('light')">浅色</button>
            </div>
          </ClientOnly>
        </div>
      </header>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { navItems } from '~/utils/nav'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const route = useRoute()
const { user } = useSession()
const colorMode = useColorMode()
const items = computed(() => (user.value ? navItems(user.value.role) : []))

useHead({
  htmlAttrs: { lang: locale },
})

function setLocale(next: string) {
  navigateTo(switchLocalePath(next))
}

function setTheme(next: 'dark' | 'light') {
  colorMode.preference = next
  if (!import.meta.client) return
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(next)
}
</script>
