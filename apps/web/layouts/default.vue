<template>
  <div class="shell" :class="`desk-${desk}`">
    <aside class="rail">
      <strong class="brand">{{ t('brand') }}</strong>
      <span v-if="workspaceLabel" class="workspace-tag">{{ workspaceLabel }}</span>
      <NuxtLink
        v-for="item in items"
        :key="item.id"
        :to="localePath(item.href)"
        :data-testid="navTestId(item.id)"
        :class="{ active: isActive(item.href) }"
      >
        {{ t(item.id) }}
      </NuxtLink>
      <p class="rail-foot">{{ t('railFoot') }}</p>
    </aside>
    <div class="main">
      <header class="top">
        <input
          v-if="desk === 'a'"
          class="search"
          type="search"
          :placeholder="locale.startsWith('zh') ? '搜索昵称或小红书号' : 'Search'"
        >
        <div data-testid="auth-session" :data-role="user?.role || undefined">
          <span class="muted">{{ user?.displayName }} {{ user?.role }}</span>
        </div>
        <ClientOnly>
          <AppChrome />
        </ClientOnly>
      </header>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { deskNav, deskOf } from '~/utils/nav'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { user } = useSession()
const desk = computed(() => deskOf(route.path))
const items = computed(() => (user.value ? deskNav(user.value.role, desk.value) : []))
const workspaceLabel = computed(() => {
  if (desk.value === 'a') return t('workspaceA')
  if (desk.value === 'b') return t('workspaceB')
  if (desk.value === 'c') return t('workspaceC')
  return ''
})

function navTestId(id: string) {
  if (id === 'ops') return 'nav-ops'
  if (id === 'dev') return 'nav-dev'
  if (id === 'select') return 'nav-select'
  if (id === 'ingest') return 'nav-ingest'
  if (id === 'assign') return 'nav-assign'
  return `nav-${id}`
}

function isActive(href: string) {
  const bare = route.path.replace(/^\/(zh-CN|en|ko)/, '') || '/'
  if (href === '/ops') return bare === '/ops'
  if (href === '/dev') return bare === '/dev'
  if (href === '/select') return bare === '/select' || bare === '/select/'
  return bare === href || bare.startsWith(`${href}/`)
}

useHead({
  htmlAttrs: { lang: locale },
})
</script>
