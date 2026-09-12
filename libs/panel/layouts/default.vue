<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" class="mr-2 h-4" />
        <p class="hidden text-sm font-medium text-foreground sm:block">
          {{ t('kcs.brand.title') }}
        </p>
        <WorkspaceSwitch class="ml-2" />
        <div class="ml-auto flex items-center gap-2">
          <CurrencySelect />
          <LocaleSelect />
          <ThemeToggle />
          <ColorSchemeSelector />
          <div
            v-if="user"
            data-testid="auth-session"
            :data-role="user.role"
            class="flex items-center gap-2 pl-1"
          >
            <Avatar class="h-8 w-8 border border-border">
              <AvatarFallback class="bg-muted text-muted-foreground text-xs">
                {{ (user.displayName?.charAt(0) || user.email.charAt(0)).toUpperCase() }}
              </AvatarFallback>
            </Avatar>
            <div class="hidden leading-tight sm:block">
              <p class="text-sm font-medium text-foreground">{{ user.displayName }}</p>
              <p class="text-xs text-muted-foreground">{{ user.role }}</p>
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
const { t, locale } = useI18n()
const localePath = useLocalePath()
const { user } = useSession()

useHead({
  title: () => t('kcs.brand.title'),
  htmlAttrs: { lang: locale },
})
</script>
