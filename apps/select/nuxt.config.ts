// 听潮 · 前台选人 — extends the shared TinyShip panel layer (libs/panel)
export default defineNuxtConfig({
  extends: ['../../libs/panel'],
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
        { to: '/', labelKey: 'kcs.panel.pool' },
        { to: '/shortlist', labelKey: 'kcs.console.nav.shortlist' },
        { to: '/projects', labelKey: 'kcs.panel.projects' },
      ],
    },
  },
})
