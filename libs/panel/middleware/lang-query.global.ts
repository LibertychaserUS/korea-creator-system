import { isValidLocale } from '@libs/i18n/codes'

export default defineNuxtRouteMiddleware((to) => {
  const raw = to.query.lang
  const lang = Array.isArray(raw) ? raw[0] : raw
  if (typeof lang !== 'string' || !isValidLocale(lang)) {
    return
  }

  const rest = to.path.replace(/^\/(en|zh-CN|ko)(?=\/|$)/, '') || '/'
  const nextPath = rest === '/' ? `/${lang}/` : `/${lang}${rest}`
  const query = { ...to.query }
  delete query.lang

  if (to.path === nextPath.replace(/\/$/, '') || to.path === nextPath) {
    if (!('lang' in to.query)) {
      return
    }
  }

  return navigateTo({ path: nextPath, query }, { redirectCode: 302 })
})
