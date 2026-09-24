// 听潮 shared panel layer — TinyShip host config consumed by the four apps
// (marketing / select / ops / dev). Each app extends this layer and only adds
// its own pages, port, and appConfig.kcs.
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import svgLoader from 'vite-svg-loader'

const layerDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(layerDir, '../..')

// Load environment variables using Vite's loadEnv
const env = loadEnv(process.env.NODE_ENV || 'development', rootDir, '')
Object.assign(process.env, env)

process.env.SQLITE_DB_PATH = resolve(rootDir, process.env.SQLITE_DB_PATH || './data/local.sqlite')

import { config as appConfig } from '../../config'

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },

  typescript: {
    typeCheck: process.env.BUILD_TIME ? false : 'build',
    tsConfig: {
      compilerOptions: {
        verbatimModuleSyntax: false,
        noUncheckedIndexedAccess: false,
      },
    },
  },

  css: [resolve(layerDir, 'assets/css/main.css')],

  vite: {
    server: {
      hmr: {
        protocol: 'ws',
        host: 'localhost',
      },
      watch: {
        // Polling exhausts macOS file descriptors on a monorepo (EMFILE).
        // Enable only where native fs events are unavailable (Docker/VM mounts).
        usePolling: process.env.NUXT_WATCH_POLLING === 'true',
        interval: 1000,
      },
      allowedHosts: ['test.vikingship.uk'],
    },
    build: {
      rollupOptions: {
        external: ['next/headers', 'next/server', 'next/navigation'],
      },
    },
    esbuild: {
      jsx: 'preserve',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
    },
    plugins: [
      tailwindcss(),
      svgLoader({
        defaultImport: 'component',
        svgoConfig: {
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  removeViewBox: false,
                },
              },
            },
          ],
        },
      }),
    ],
    optimizeDeps: {
      include: ['pg', 'drizzle-orm'],
    },
  },

  nitro: {
    experimental: {
      wasm: true,
    },
    commonJS: {
      include: [/pg/, /drizzle-orm/],
    },
    externals: {
      inline: ['zod'],
    },
    // .br / .gz siblings for /_nuxt assets; Nitro serves them by Accept-Encoding,
    // so the edge proxy never has to compress static files itself.
    compressPublicAssets: { gzip: true, brotli: true },
    dev: process.env.NODE_ENV === 'development',
  },

  // Anything read from process.env here is frozen into .output at build time.
  // Origins are therefore plain defaults that Nuxt overrides at runtime from
  // NUXT_<KEY> / NUXT_PUBLIC_<KEY> (e.g. NUXT_PUBLIC_OPS_URL), so one image
  // serves any domain; DATABASE_URL / BETTER_AUTH_SECRET are not copied in at
  // all (@libs/database and @libs/auth read process.env at runtime).
  runtimeConfig: {
    // OAuth provider credentials (public redirect flow only; secrets stay server-side)
    wechatAppId: process.env.WECHAT_APP_ID || '',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    appleClientId: process.env.APPLE_CLIENT_ID || '',
    // Server-only: where SSR reaches the API (compose: http://api:7100, no
    // hairpin through the public domain). Empty = use public.apiBase.
    apiInternalBase: '',
    public: {
      apiBase: 'http://localhost:7100',
      // The four 听潮 apps, for cross-app login redirects and marketing CTAs
      marketingUrl: 'http://localhost:7000',
      selectUrl: 'http://localhost:7004',
      opsUrl: 'http://localhost:7002',
      devUrl: 'http://localhost:7003',
      // Parent domain shared by the apps and the API (`.example.com`), same value
      // as AUTH_COOKIE_DOMAIN; empty = host-only cookies.
      cookieDomain: '',
      captchaEnabled: String(appConfig.captcha.enabled),
      turnstileSiteKey: appConfig.captcha.cloudflare.siteKey || '0x4AAAAAAABkMYinukNdH9ly',
      wechatAppId: appConfig.auth.socialProviders.wechat.appId || '',
      // Social login buttons: only "configured?" booleans go public — never secrets.
      // Unconfigured providers render disabled with 未配置.
      socialLogin: {
        wechat: Boolean(process.env.WECHAT_APP_ID || ''),
        google: Boolean(process.env.GOOGLE_CLIENT_ID || ''),
        apple: Boolean(process.env.APPLE_CLIENT_ID || ''),
      },
      paymentPlans: JSON.parse(JSON.stringify(appConfig.payment.plans)),
    },
  },

  alias: {
    '@libs': resolve(rootDir, 'libs'),
    '@config': resolve(rootDir, 'config.ts'),
    '@kcs/contract': resolve(rootDir, 'packages/kcs-contract/src/index.ts'),
  },

  hooks: {
    // Nuxt 4 传统（非 environments）模式下，SSR vite server 即使 hmr:false
    // 也会绑定 24678（vite 的关闭开关是 server.ws 而非 hmr）。四个端同机
    // 齐开必然撞端口；SSR 侧模块热更走 vite-node 的 unix socket，这个 WS
    // 用不到，只对 SSR 配置关掉，客户端 HMR 不受影响。
    'vite:extendConfig'(config, { isServer }) {
      if (!isServer) return
      const cfg = config as { server?: Record<string, unknown> }
      cfg.server = { ...cfg.server, ws: false }
    },
  },

  build: {
    transpile: ['pg', 'drizzle-orm'],
  },

  modules: ['shadcn-nuxt', '@pinia/nuxt', '@nuxtjs/i18n', 'nuxt-charts', 'motion-v/nuxt'],

  components: {
    dirs: [
      {
        path: resolve(layerDir, 'components'),
        pathPrefix: false,
        extensions: ['.vue'],
      },
    ],
  },

  i18n: {
    bundle: {
      optimizeTranslationDirective: false,
    },
    vueI18n: resolve(layerDir, 'i18n/i18n.config.ts'),
    locales: appConfig.app.i18n.locales.map(code => ({
      code,
      name: ({ en: 'English', 'zh-CN': '中文', ko: '한국어' } as const)[code] ?? code,
    })),
    defaultLocale: appConfig.app.i18n.defaultLocale,
    strategy: 'prefix',
    detectBrowserLanguage: appConfig.app.i18n.autoDetect
      ? {
          useCookie: true,
          cookieKey: appConfig.app.i18n.cookieKey,
          redirectOn: 'root',
          alwaysRedirect: true,
          fallbackLocale: appConfig.app.i18n.defaultLocale,
        }
      : false,
  },

  shadcn: {
    prefix: '',
    componentDir: resolve(layerDir, 'components/ui'),
  },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/android-chrome-192x192.png' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/android-chrome-512x512.png' },
        { rel: 'mask-icon', href: '/logo.svg', color: '#17201D' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
      meta: [
        { name: 'theme-color', content: '#EEF1ED' },
        { name: 'msapplication-TileColor', content: '#EEF1ED' },
        { name: 'msapplication-config', content: 'none' },
      ],
    },
  },
})
