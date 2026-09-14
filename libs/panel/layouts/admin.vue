<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger />
        <div class="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <ColorSchemeSelector />
        </div>
      </header>
      <slot />
    </SidebarInset>
  </SidebarProvider>
</template>
