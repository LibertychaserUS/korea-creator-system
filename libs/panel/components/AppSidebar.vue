<template>
  <Sidebar>
    <SidebarHeader class="p-4 border-b border-sidebar-border">
      <NuxtLink :to="localePath('/')">
        <AppLogo size="md" />
      </NuxtLink>
      <p class="mt-2 text-xs text-muted-foreground">{{ t('kcs.brand.tagline') }}</p>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>{{ t(labelKey) }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in items" :key="item.to">
              <SidebarMenuButton as-child :is-active="isRouteActive(item.to)">
                <NuxtLink :to="localePath(item.to)" :data-testid="testidOf(item.to)">
                  <component :is="iconOf(item.to)" />
                  <span>{{ t(item.labelKey) }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</template>

<script setup lang="ts">
import { Activity, ClipboardList, LayoutDashboard, Users } from 'lucide-vue-next'

type KcsNavItem = { to: string; labelKey: string }
type KcsAppConfig = {
  key?: string
  labelKey?: string
  nav?: KcsNavItem[]
}

/**
 * 四端各自的侧栏：只渲染当前 app 在 appConfig.kcs.nav 里声明的条目。
 * 跨端跳转交给 WorkspaceSwitch（按源站 URL），侧栏不再承担。
 */
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const kcs = useAppConfig().kcs as KcsAppConfig | undefined
const labelKey = computed(() => kcs?.labelKey || 'kcs.brand.title')
const items = computed<KcsNavItem[]>(() => kcs?.nav ?? [])

const barePath = computed(() => route.path.replace(/^\/(zh-CN|en|ko)/, '') || '/')

const isRouteActive = (path: string) => {
  const bare = barePath.value
  if (path === '/') return bare === '/'
  return bare === path || bare.startsWith(`${path}/`)
}

const testidOf = (path: string) => `nav-${path === '/' ? 'home' : path.replaceAll('/', '-')}`

const iconOf = (path: string) => {
  const key = `${kcs?.key ?? ''}${path}`
  if (key.startsWith('select')) return Users
  if (key.startsWith('ops')) return ClipboardList
  if (key.startsWith('dev')) return Activity
  return LayoutDashboard
}
</script>
