<template>
  <Sidebar class="border-sidebar-border">
    <SidebarHeader class="gap-0 p-0">
      <NuxtLink :to="localePath('/')" class="flex items-center gap-3 px-4 pb-3 pt-4">
        <AppLogo size="md" :show-text="false" />
        <div class="min-w-0 leading-tight">
          <p class="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">{{ t('kcs.brand.title') }}</p>
          <p class="truncate text-[11px] text-muted-foreground">{{ t(labelKey) }}</p>
        </div>
      </NuxtLink>
      <div class="tide-rule mx-4" aria-hidden="true" />
    </SidebarHeader>

    <SidebarContent class="px-2 pt-2">
      <SidebarGroup>
        <SidebarGroupLabel class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/80">
          {{ t(labelKey) }}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu class="gap-0.5">
            <SidebarMenuItem v-for="item in items" :key="item.to">
              <SidebarMenuButton as-child :is-active="isRouteActive(item.to)" class="group/nav h-9 rounded-lg px-2.5">
                <NuxtLink :to="localePath(item.to)" :data-testid="testidOf(item.to)">
                  <span
                    class="h-4 w-0.5 -ml-1 mr-0.5 rounded-full bg-primary opacity-0 transition-opacity group-data-[active=true]/nav:opacity-100"
                    aria-hidden="true"
                  />
                  <component :is="iconOf(item.to)" class="text-muted-foreground group-data-[active=true]/nav:text-primary" />
                  <span>{{ t(item.labelKey) }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter class="gap-3 p-3">
      <p class="px-1 text-[11px] leading-relaxed text-muted-foreground/80">{{ t('kcs.brand.tagline') }}</p>
      <div v-if="user" class="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-background/60 p-2">
        <Avatar class="h-8 w-8 border border-border">
          <AvatarFallback class="bg-primary/10 text-xs font-medium text-primary">
            {{ initial }}
          </AvatarFallback>
        </Avatar>
        <div class="min-w-0 flex-1 leading-tight">
          <p class="truncate text-sm font-medium text-sidebar-foreground">{{ user.displayName }}</p>
          <p class="truncate text-[11px] text-muted-foreground">{{ roleLabel }}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-muted-foreground hover:text-foreground"
          :title="t('kcs.panel.signOut')"
          :aria-label="t('kcs.panel.signOut')"
          data-testid="btn-sign-out"
          @click="signOut"
        >
          <LogOut class="size-4" />
        </Button>
      </div>
    </SidebarFooter>
  </Sidebar>
</template>

<script setup lang="ts">
import { Activity, ClipboardList, DatabaseZap, FileSpreadsheet, FolderKanban, Gauge, Languages, LayoutDashboard, ListChecks, LogOut, ScrollText, SlidersHorizontal, Tags, UserCog, UserPlus, Users } from 'lucide-vue-next'
import { can, type Permission } from '@kcs/contract'

type KcsNavItem = { to: string; labelKey: string; perm?: Permission }
type KcsAppConfig = {
  key?: string
  labelKey?: string
  nav?: KcsNavItem[]
}

/**
 * 四端各自的侧栏：只渲染当前 app 在 appConfig.kcs.nav 里声明的条目。
 * 跨端跳转交给 WorkspaceSwitch（按源站 URL），侧栏不再承担。
 */
const { t, te } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { user, token } = useSession()
const { request } = useApi()

const kcs = useAppConfig().kcs as KcsAppConfig | undefined
const labelKey = computed(() => kcs?.labelKey || 'kcs.brand.title')
// 带 perm 的条目只给有这项权限的人看（例如运维端的「账号」只给平台管理员）。
const items = computed<KcsNavItem[]>(() =>
  (kcs?.nav ?? []).filter((item) => !item.perm || (user.value ? can(user.value.role, item.perm) : false)),
)

const barePath = computed(() => route.path.replace(/^\/(zh-CN|en|ko)/, '') || '/')

const matches = (path: string) => {
  const bare = barePath.value
  if (path === '/') return bare === '/'
  return bare === path || bare.startsWith(`${path}/`)
}

// `/creators/new` should light up 录入博主, not 博主 as well.
const isRouteActive = (path: string) =>
  matches(path) && !items.value.some((item) => item.to.length > path.length && item.to.startsWith(path) && matches(item.to))

const testidOf = (path: string) => `nav-${path === '/' ? 'home' : path.replaceAll('/', '-')}`

const iconOf = (path: string) => {
  const key = `${kcs?.key ?? ''}${path}`
  if (key === 'select/projects') return FolderKanban
  if (key === 'ops/creators/new') return UserPlus
  if (key === 'ops/creators') return Users
  if (key === 'ops/sources') return DatabaseZap
  if (key === 'dev/accounts') return UserCog
  if (key === 'dev/pipeline') return Gauge
  if (key === 'dev/audit') return ScrollText
  if (key === 'dev/i18n-theme') return Languages
  if (key === 'dev/cohorts') return SlidersHorizontal
  if (key === 'ops/categories') return Tags
  if (key === 'ops/batches') return FileSpreadsheet
  if (key === 'select/shortlist') return ListChecks
  if (key.startsWith('select')) return Users
  if (key.startsWith('ops')) return ClipboardList
  if (key.startsWith('dev')) return Activity
  return LayoutDashboard
}

const initial = computed(() => (user.value?.displayName?.charAt(0) || user.value?.email.charAt(0) || '?').toUpperCase())
const roleLabel = computed(() => {
  const key = `kcs.roles.${user.value?.role}`
  return te(key) ? t(key) : user.value?.role ?? ''
})

async function signOut() {
  try {
    // 身份在 TinyShip（better-auth）；退出走本端源站，由服务端撤销会话并清 cookie
    await fetch('/__logout', { method: 'POST', credentials: 'include' })
  } catch {
    // 会话可能已经过期，本地照样清
  }
  token.value = null
  user.value = null
  await navigateTo(localePath('/login'))
}
</script>

<style scoped>
/* 侧栏顶部一道潮线：深海到沙色的细渐变，呼应登录页的潮声背景 */
.tide-rule {
  height: 1px;
  background: linear-gradient(90deg, oklch(0.45 0.085 235 / 0.7), oklch(0.88 0.07 75 / 0.6) 60%, transparent);
}
</style>
