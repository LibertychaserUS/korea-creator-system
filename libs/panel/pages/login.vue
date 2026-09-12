<template>
  <Card class="border-border/60 shadow-lg">
    <CardHeader>
      <CardTitle>{{ t('kcs.panel.signIn') }}</CardTitle>
      <CardDescription>{{ t('kcs.panel.signInLead') }}</CardDescription>
    </CardHeader>
    <CardContent>
      <form method="post" :action="loginAction" class="grid gap-4" enctype="application/x-www-form-urlencoded">
        <input type="hidden" name="locale" :value="locale" />
        <div class="grid gap-2">
          <Label for="email">{{ t('kcs.panel.email') }}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            data-testid="login-email"
            autocomplete="username"
            :placeholder="t('kcs.panel.email')"
          />
        </div>
        <div class="grid gap-2">
          <Label for="password">{{ t('kcs.panel.password') }}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            data-testid="login-password"
            autocomplete="current-password"
          />
        </div>
        <p v-if="error" class="text-sm text-destructive" data-testid="login-error">{{ error }}</p>
        <Button data-testid="login-submit" type="submit" class="w-full">
          {{ t('kcs.panel.enter') }}
        </Button>
      </form>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t, locale } = useI18n()
const route = useRoute()
const req = useRequestURL()
const loginAction = computed(() => `${req.origin}/__login`)
const error = computed(() => (route.query.error ? t('kcs.panel.loginError') : ''))
</script>
