<script setup lang="ts">
import { Toaster } from '@libs/panel/components/ui/sonner'
import 'vue-sonner/style.css'
import { ALL_THEME_CLASSES } from '@libs/ui/themes'

// 挑选端默认深色：独立存储 key（kcs-select-theme），不与营销/运维/开发端
// 共享 kcs-ui-theme——四端同浏览器互不影响；手动切换后照常持久化并尊重选择。
// 逻辑与 libs/panel/app.vue 的 FOUC 脚本保持一致，仅默认值与 key 不同。
useHead({
  script: [
    {
      innerHTML: `
        (function() {
          // Theme configuration: select workspace defaults to dark
          const THEME_CONFIG = {
            defaultTheme: 'dark',
            defaultColorScheme: 'tide',
            storageKey: 'kcs-select-theme'
          };

          // All possible theme classes for cleanup - imported from @libs/ui/themes
          const ALL_THEME_CLASSES = ${JSON.stringify(ALL_THEME_CLASSES)};

          // Try to get stored theme preferences
          let currentTheme = THEME_CONFIG.defaultTheme;
          let currentColorScheme = THEME_CONFIG.defaultColorScheme;

          try {
            if (typeof localStorage !== 'undefined') {
              const pref = localStorage.getItem(THEME_CONFIG.storageKey + '-pref');
              if (pref === 'light' || pref === 'dark') {
                currentTheme = pref;
              } else if (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                currentTheme = 'dark';
              } else if (pref === 'system') {
                currentTheme = 'light';
              }
              const stored = localStorage.getItem(THEME_CONFIG.storageKey);
              if (stored) {
                const parsed = JSON.parse(stored);
                if (!pref && parsed.theme) currentTheme = parsed.theme;
                if (parsed.colorScheme) currentColorScheme = parsed.colorScheme;
              }
            }
          } catch (e) {
            // Fallback to defaults if localStorage fails
            console.warn('Failed to load theme from localStorage, using defaults:', e);
          }

          // Apply theme classes immediately to document root
          const html = document.documentElement;

          // Remove all existing theme classes first
          html.classList.remove(...ALL_THEME_CLASSES);

          // Apply theme class (only dark needs explicit class, light is default)
          if (currentTheme === 'dark') {
            html.classList.add('dark');
          }

          // Apply color scheme class（听潮仅 tide 一套，恒加 theme-tide）
          if (currentColorScheme !== 'default') {
            html.classList.add('theme-' + currentColorScheme);
          }

          // Store the applied theme state for client-side consistency
          window.__INITIAL_THEME_STATE__ = {
            theme: currentTheme,
            colorScheme: currentColorScheme
          };
        })();
      `,
      type: 'text/javascript'
    }
  ]
})
</script>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <CookieConsent />
    <Toaster />
  </div>
</template>
