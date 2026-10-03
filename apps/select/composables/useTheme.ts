// 挑选端主题 composable —— 覆盖 libs/panel 层同名 composable（Nuxt 中 app 的
// composables/ 优先于 extended layer）。
//
// 与层内版本语义一致，仅两点不同：
//  1. 默认主题 dark（首次访问无存储偏好时直接进入深色工作面）；
//  2. 独立存储 key `kcs-select-theme` —— 不与营销/运维/开发端共享
//     `kcs-ui-theme`，四端在同一浏览器里互不影响；手动切换后照常持久化。
import {
  type Theme,
  type ColorScheme,
  type ThemeState,
  applyThemeToDocument,
  getStoredThemeState,
  saveThemeState
} from '@libs/ui/themes'

const STORAGE_KEY = 'kcs-select-theme'
const DEFAULT_STATE: ThemeState = { theme: 'dark', colorScheme: 'tide' }

// Check if we have initial theme state from app.vue script
const getInitialThemeState = (): ThemeState => {
  if (import.meta.client && typeof window !== 'undefined' && (window as any).__INITIAL_THEME_STATE__) {
    return (window as any).__INITIAL_THEME_STATE__ as ThemeState
  }

  // Fallback to select defaults
  return { ...DEFAULT_STATE }
}

const initialState = getInitialThemeState()
const theme = ref<Theme>(initialState.theme)
const colorScheme = ref<ColorScheme>(initialState.colorScheme)
const isInitialized = ref(false)
// Track hydration state to prevent mismatches
const isHydrated = ref(false)

export const useTheme = () => {

  // Initialize state from localStorage or use select defaults
  const initializeTheme = () => {
    if (!import.meta.client) return false

    // If we already have initial state from app.vue script, use it
    if ((window as any).__INITIAL_THEME_STATE__) {
      const initialState = (window as any).__INITIAL_THEME_STATE__ as ThemeState
      theme.value = initialState.theme
      colorScheme.value = initialState.colorScheme

      // Clean up the global variable
      delete (window as any).__INITIAL_THEME_STATE__

      return true // Theme already applied by app.vue script
    }

    // Fallback: check localStorage directly
    const stored = getStoredThemeState(STORAGE_KEY)

    if (stored) {
      theme.value = stored.theme
      colorScheme.value = stored.colorScheme
      return false // Need to apply theme
    } else {
      // No stored preferences, keep select defaults and will save them
      return false // Need to apply theme
    }
  }

  // Apply theme classes to document
  const applyTheme = (saveToStorage = true) => {
    if (!import.meta.client) return

    // Apply theme to document
    applyThemeToDocument(theme.value, colorScheme.value)

    // Save to localStorage if requested and preference consent allows it
    const { allowsPreferences } = useConsent()
    if (saveToStorage && isInitialized.value && allowsPreferences.value) {
      saveThemeState(STORAGE_KEY, {
        theme: theme.value,
        colorScheme: colorScheme.value
      })
    }
  }

  // Theme setters
  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme
  }

  const setColorScheme = (newColorScheme: ColorScheme) => {
    colorScheme.value = newColorScheme
  }

  // Initialize only once
  if (import.meta.client && !isInitialized.value) {
    onMounted(() => {
      const themeAlreadyApplied = initializeTheme()

      // Only apply theme if it wasn't already applied by app.vue script
      if (!themeAlreadyApplied) {
        const hasStoredPreferences = getStoredThemeState(STORAGE_KEY) !== null
        applyTheme(!hasStoredPreferences) // Save to localStorage if no stored preferences found
      }

      isInitialized.value = true

      // Consent withdrawn → drop this app's theme store too (useConsent only
      // clears the shared panel key; select keeps its own).
      const { allowsPreferences } = useConsent()
      watch(allowsPreferences, (allowed) => {
        if (!allowed && typeof localStorage !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY)
          localStorage.removeItem(`${STORAGE_KEY}-pref`)
        }
      })

      // Mark as hydrated after initial mount
      nextTick(() => {
        isHydrated.value = true

        // Watch for changes and apply them
        watch([theme, colorScheme], () => applyTheme(true), { immediate: false })
      })
    })
  }

  return {
    theme: readonly(theme),
    colorScheme: readonly(colorScheme),
    isHydrated: readonly(isHydrated),
    setTheme,
    setColorScheme
  }
}

// Export types for external use
export type { Theme, ColorScheme, ThemeState }
