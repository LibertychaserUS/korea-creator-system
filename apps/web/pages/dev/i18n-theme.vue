<template>
  <ScreenFrame testid="screen-b-i18n-theme" title="语言 / 主题状态">
    <div class="cards">
      <div class="card"><div class="muted">当前语言</div><strong>{{ locale }}</strong></div>
      <div class="card"><div class="muted">当前主题</div><strong>{{ theme }}</strong></div>
    </div>
    <table>
      <thead>
        <tr><th>支持语言</th><th>支持主题</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>{{ (info.locales || []).join(' / ') }}</td>
          <td>{{ (info.themes || []).join(' / ') }}</td>
        </tr>
      </tbody>
    </table>
    <AppChrome />
  </ScreenFrame>
</template>

<script setup lang="ts">
const { locale } = useI18n()
const { request } = useApi()
const info = ref<{ locales?: string[]; themes?: string[] }>({})
const theme = ref('light')
onMounted(async () => {
  info.value = await request('/api/dev/i18n-theme')
  theme.value = document.documentElement.getAttribute('data-theme') || 'light'
})
</script>
