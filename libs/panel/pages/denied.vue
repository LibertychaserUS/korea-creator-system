<template>
  <PanelPage testid="screen-denied" :title="t('kcs.panel.denied')">
    <Card>
      <CardHeader>
        <CardTitle>{{ t('kcs.panel.denied') }}</CardTitle>
        <CardDescription>{{ t('kcs.panel.deniedBody') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-wrap gap-2">
        <Button as-child>
          <NuxtLink :to="localePath('/')">{{ t('kcs.nav.overview') }}</NuxtLink>
        </Button>
        <Button variant="outline" data-testid="denied-switch-account" @click="switchAccount">
          {{ t('kcs.panel.signOut') }}
        </Button>
      </CardContent>
    </Card>
  </PanelPage>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { token } = useApi()
const { user } = useSession()

/** 账号没有分工时首页会一直弹回这里；给一条换账号的出路。 */
async function switchAccount() {
  try {
    await fetch('/__logout', { method: 'POST', credentials: 'include' })
  } catch {
    // 会话可能已失效，本地照样清
  }
  token.value = null
  user.value = null
  await navigateTo(localePath('/login'))
}
</script>
