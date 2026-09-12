<template>
  <PanelPage testid="screen-denied" :title="t('kcs.panel.denied')">
    <Card>
      <CardHeader>
        <CardTitle>{{ t('kcs.panel.denied') }}</CardTitle>
        <CardDescription>{{ t('kcs.panel.deniedBody') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button as-child>
          <NuxtLink :to="localePath('/')">{{ t('kcs.nav.overview') }}</NuxtLink>
        </Button>
      </CardContent>
    </Card>
  </PanelPage>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
</script>
