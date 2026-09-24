import { config } from '@config'

// Messages come from i18n/locales/<code>.ts, loaded per language (nuxt.config `lazy`).
export default defineI18nConfig(() => {
  return {
    legacy: false,
    locale: config.app.i18n.defaultLocale,
    fallbackLocale: config.app.i18n.defaultLocale,
  }
})
