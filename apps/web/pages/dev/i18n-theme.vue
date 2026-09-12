<template>
  <ScreenFrame testid="screen-b-i18n-theme" :title="t('devDesk.i18n')">
    <div class="cards">
      <div class="card"><div class="muted">locale</div><strong>{{ locale }}</strong></div>
      <div class="card"><div class="muted">theme</div><strong>{{ theme }}</strong></div>
    </div>
    <table class="ledger-table">
      <thead>
        <tr><th>zh-CN / en / ko</th><th>theme</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>{{ (info.locales || ['zh-CN', 'en', 'ko']).join(' / ') }}</td>
          <td>{{ (info.themes || []).join(' / ') }}</td>
        </tr>
      </tbody>
    </table>
    <div class="token-preview">
      <div class="swatch"><i style="background:#f4f0e6" /><i style="background:#1f4d3a" /><i style="background:#1a1916" /></div>
      <span>paper / pine / ink</span>
    </div>
    <AppChrome />
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
const { request } = useApi()
const info = ref<{ locales?: string[]; themes?: string[] }>({})
const theme = ref('light')
onMounted(async () => {
  info.value = await request('/api/dev/i18n-theme')
  theme.value = document.documentElement.getAttribute('data-theme') || 'light'
})
</script>
