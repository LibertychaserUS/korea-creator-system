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
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :is-active="isRouteActive('/') && barePath === '/'">
                <NuxtLink :to="localePath('/')">
                  <LayoutDashboard />
                  <span>{{ t('kcs.nav.overview') }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>{{ t('kcs.nav.workspaces') }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in items" :key="item.to">
              <SidebarMenuButton as-child :is-active="isRouteActive(item.to)">
                <NuxtLink :to="localePath(item.to)" :data-testid="item.testid">
                  <component :is="item.icon" />
                  <span>{{ t(item.label) }}</span>
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
import { can } from '@kcs/contract'
import { Activity, ClipboardList, LayoutDashboard, Users } from 'lucide-vue-next'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { user } = useSession()

const barePath = computed(() => route.path.replace(/^\/(zh-CN|en|ko)/, '') || '/')

const catalog = [
  { to: '/ops', label: 'kcs.nav.ops', testid: 'nav-ops', icon: ClipboardList, perm: 'ops.read' as const },
  { to: '/select', label: 'kcs.nav.select', testid: 'nav-select', icon: Users, perm: 'select.read' as const },
  { to: '/dev', label: 'kcs.nav.monitor', testid: 'nav-dev', icon: Activity, perm: 'dev.read' as const },
]

const items = computed(() => {
  if (!user.value) return catalog
  return catalog.filter(item => can(user.value!.role, item.perm))
})

const isRouteActive = (path: string) => {
  const bare = barePath.value
  if (path === '/') return bare === '/'
  return bare === path || bare.startsWith(`${path}/`)
}
</script>
