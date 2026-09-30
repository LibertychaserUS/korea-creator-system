<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger />
        <div class="ml-auto flex items-center gap-2">
          <!-- 主题收敛后只剩 tide 一套配色，配色选择器不再渲染（组件文件保留） -->
          <ThemeToggle />
        </div>
      </header>
      <slot />
    </SidebarInset>
  </SidebarProvider>
</template>
