// 听潮 · 监控面板 — extends the shared TinyShip panel layer (libs/panel)
export default defineNuxtConfig({
  extends: ['../../libs/panel'],
  devServer: {
    port: 7003,
  },
  appConfig: {
    kcs: {
      key: 'dev',
      labelKey: 'kcs.nav.monitor',
      perm: 'dev.read',
      nav: [
        { to: '/', labelKey: 'kcs.panel.health' },
        { to: '/pipeline', labelKey: 'kcs.console.nav.pipeline' },
        { to: '/audit', labelKey: 'kcs.console.nav.audit' },
        { to: '/cohorts', labelKey: 'kcs.console.nav.cohorts' },
        { to: '/i18n-theme', labelKey: 'kcs.console.nav.i18n' },
        { to: '/accounts', labelKey: 'kcs.nav.accounts', perm: 'admin.users' },
      ],
    },
  },
})
