// 听潮 · 前台选人 — extends the shared TinyShip panel layer (libs/panel)
import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  extends: ['../../libs/panel'],
  css: [fileURLToPath(new URL('./assets/select.css', import.meta.url))],
  devServer: {
    // 7001 stays with the legacy TinyShip panel (apps/nuxt-app, e2e contract host).
    port: 7004,
  },
  appConfig: {
    kcs: {
      key: 'select',
      labelKey: 'kcs.nav.select',
      perm: 'select.read',
      nav: [
        { to: '/missions', labelKey: 'kcs.nav.missions' },
        { to: '/', labelKey: 'kcs.panel.pool' },
        { to: '/shortlist', labelKey: 'kcs.console.nav.shortlist' },
        { to: '/projects', labelKey: 'kcs.panel.projects' },
      ],
    },
  },
})
