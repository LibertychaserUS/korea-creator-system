// 听潮 · 后台录入 — extends the shared TinyShip panel layer (libs/panel)
export default defineNuxtConfig({
  extends: ['../../libs/panel'],
  devServer: {
    port: 7002,
  },
  vite: {
    server: {
      hmr: { port: 7402 },
    },
  },
  appConfig: {
    kcs: {
      key: 'ops',
      labelKey: 'kcs.nav.ops',
      perm: 'ops.read',
      nav: [
        { to: '/', labelKey: 'kcs.panel.opsHome' },
        { to: '/creators/new', labelKey: 'kcs.panel.createCreator' },
      ],
    },
  },
})
