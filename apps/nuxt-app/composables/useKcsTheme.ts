import { config } from '@config'
import { applyThemeToDocument, type Theme } from '@libs/ui/themes'

export type ThemePreference = Theme | 'system'

const STORAGE_KEY = `${config.app.theme.storageKey}-pref`

const preference = ref<ThemePreference>('system')
const resolved = ref<Theme>(config.app.theme.defaultTheme)
const hydrated = ref(false)

const resolvePreference = (pref: ThemePreference): Theme => {
  if (pref !== 'system') {
    return pref
  }
  if (import.meta.client && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

const persist = () => {
  if (!import.meta.client) return
  localStorage.setItem(STORAGE_KEY, preference.value)
}

const apply = () => {
  if (!import.meta.client) return
  resolved.value = resolvePreference(preference.value)
  applyThemeToDocument(resolved.value, 'default')
  document.documentElement.dataset.kcsTheme = preference.value
}

export const useKcsTheme = () => {
  const setPreference = (next: ThemePreference) => {
    preference.value = next
    apply()
    persist()
  }

  if (import.meta.client && !hydrated.value) {
    onMounted(() => {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        preference.value = stored
      }
      apply()
      hydrated.value = true
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => {
        if (preference.value === 'system') apply()
      }
      media.addEventListener('change', onChange)
    })
  }

  return {
    preference: readonly(preference),
    resolved: readonly(resolved),
    hydrated: readonly(hydrated),
    setPreference,
  }
}
