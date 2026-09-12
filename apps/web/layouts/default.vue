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
        <ClientOnly>
          <AppChrome />
        </ClientOnly>
      </header>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { navItems } from '~/utils/nav'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { user } = useSession()
const items = computed(() => (user.value ? navItems(user.value.role) : []))

useHead({
  htmlAttrs: { lang: locale },
})
</script>
