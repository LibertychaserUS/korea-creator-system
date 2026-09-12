import { applyDocumentTheme, type ThemeName } from '~/utils/theme'

export default defineNuxtPlugin(() => {
  const stored = localStorage.getItem('kcs-ui-theme-pref')
  if (stored === 'dark' || stored === 'light') {
    applyDocumentTheme(document.documentElement, stored as ThemeName)
  }
})
