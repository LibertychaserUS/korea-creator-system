<template>
  <div class="login-wrap">
    <div class="login-chrome">
      <ClientOnly>
        <AppChrome />
      </ClientOnly>
    </div>
    <slot />
  </div>
</template>
