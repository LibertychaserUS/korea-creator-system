import { config } from '@config'

export type ConsentLevel = 'all' | 'necessary'

/**
 * Cookie consent state.
 * - 'necessary': session/auth only — no preference persistence (locale, currency, theme).
 * - 'all': preference cookies/localStorage may be written.
 */
export function useConsent() {
  const cookie = useCookie<ConsentLevel | null>('kcs_consent', {
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  })
  const level = useState<ConsentLevel | null>('kcs-consent', () => cookie.value ?? null)

  const decided = computed(() => level.value !== null)
  const allowsPreferences = computed(() => level.value === 'all')

  function choose(next: ConsentLevel) {
    level.value = next
    cookie.value = next
    if (next === 'necessary') {
      // Real refusal: drop every preference store we control.
      const localeCookie = useCookie<string | null>(config.app.i18n.cookieKey, { path: '/' })
      localeCookie.value = null
      const currencyCookie = useCookie<string | null>('kcs_currency', { path: '/' })
      currencyCookie.value = null
      const wsCookie = useCookie<string | null>('kcs_last_ws', { path: '/' })
      wsCookie.value = null
      if (import.meta.client) {
        const key = config.app.theme.storageKey
        localStorage.removeItem(key)
        localStorage.removeItem(`${key}-pref`)
      }
    }
  }

  return { level, decided, allowsPreferences, choose }
}
