// 听潮 · 宣传页 — extends the shared TinyShip panel layer (libs/panel)
// Public site: no workspace permission, all routes open.
export default defineNuxtConfig({
  extends: ['../../libs/panel'],
  devServer: {
    port: 7000,
  },
  vite: {
    server: {
      hmr: { port: 7400 },
    },
  },
  appConfig: {
    kcs: {
      key: 'marketing',
      labelKey: 'kcs.brand.title',
      perm: null,
      nav: [],
    },
  },
})
