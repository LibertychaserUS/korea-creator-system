<template>
  <SidebarProvider>
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring"
      data-testid="skip-to-content"
    >{{ t('kcs.console.a11y.skip') }}</a>
    <AppSidebar />
    <SidebarInset id="main-content" tabindex="-1" class="min-w-0 bg-muted/30 outline-none dark:bg-background">
      <header
        class="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4"
      >
        <SidebarTrigger class="-ml-1 text-muted-foreground hover:text-foreground" :aria-label="t('kcs.console.a11y.sidebar')" :title="t('kcs.console.a11y.sidebar')" />
        <Separator orientation="vertical" class="mr-1 hidden h-4 sm:block" />
        <WorkspaceSwitch />
        <div class="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <!-- 币种 / 配色属于低频偏好，手机上收进更宽的断点，避免顶栏横向溢出 -->
          <div class="hidden items-center md:flex">
            <CurrencySelect />
          </div>
          <LocaleSelect />
          <ThemeToggle />
          <div class="hidden items-center md:flex">
            <ColorSchemeSelector />
          </div>
          <Separator orientation="vertical" class="mx-1 hidden h-4 sm:block" />
          <div
            v-if="user"
            data-testid="auth-session"
            :data-role="user.role"
            class="flex items-center gap-2 pl-0.5"
          >
            <Avatar class="h-7 w-7 border border-border">
              <AvatarFallback class="bg-primary/10 text-[11px] font-medium text-primary">
                {{ (user.displayName?.charAt(0) || user.email.charAt(0)).toUpperCase() }}
              </AvatarFallback>
            </Avatar>
            <div class="hidden leading-tight lg:block">
              <p class="text-sm font-medium text-foreground">{{ user.displayName }}</p>
              <p class="text-[11px] text-muted-foreground">{{ roleLabel }}</p>
            </div>
          </div>
          <Button v-else as-child size="sm">
            <NuxtLink :to="localePath('/login')">{{ t('common.login') }}</NuxtLink>
          </Button>
        </div>
      </header>
      <slot />
    </SidebarInset>
  </SidebarProvider>
</template>

<script setup lang="ts">
const { t, te, locale } = useI18n()
const localePath = useLocalePath()
const { user } = useSession()

const roleLabel = computed(() => {
  const key = `kcs.roles.${user.value?.role}`
  return te(key) ? t(key) : user.value?.role ?? ''
})

useHead({
  title: () => t('kcs.brand.title'),
  htmlAttrs: { lang: locale },
})
</script>
