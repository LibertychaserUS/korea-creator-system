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
      nav: [{ to: '/', labelKey: 'kcs.panel.health' }],
    },
  },
})
