export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [
      { code: 'zh-CN', language: 'zh-CN', name: '中文', file: 'zh-CN.ts' },
      { code: 'en', language: 'en', name: 'English', file: 'en.ts' },
      { code: 'ko', language: 'ko', name: '한국어', file: 'ko.ts' },
    ],
    defaultLocale: 'zh-CN',
    lazy: true,
    langDir: 'locales',
    strategy: 'prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'NEXT_LOCALE',
    },
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:7100',
    },
  },
  app: {
    head: {
      title: '全球达人情报系统',
      htmlAttrs: { lang: 'zh-CN' },
    },
  },
  devServer: { port: 7001 },
  vite: {
    server: {
      watch: {
        ignored: ['**/.pnpm-store/**', '**/node_modules/**', '**/.git/**', '**/test-results/**'],
      },
    },
  },
  ignore: ['**/.pnpm-store/**', '**/test-results/**'],
})
