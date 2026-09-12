<template>
  <div class="login-card" data-testid="screen-a-login" data-screen="C-login">
    <div data-testid="screen-c-login">
      <h1>{{ t('brand') }}</h1>
      <p class="muted">{{ t('login') }} · 运营录入 / 选人公司</p>
      <form method="post" :action="loginAction" enctype="application/x-www-form-urlencoded">
        <input type="hidden" name="locale" :value="locale" />
        <label class="field">
          {{ t('email') }}
          <input name="email" data-testid="login-email" type="email" autocomplete="username" />
        </label>
        <label class="field">
          {{ t('password') }}
          <input name="password" data-testid="login-password" type="password" autocomplete="current-password" />
        </label>
        <p v-if="error" class="err" data-testid="login-error">{{ error }}</p>
        <button class="btn" data-testid="login-submit" type="submit">{{ t('login') }}</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const { t, locale } = useI18n()
const route = useRoute()
const req = useRequestURL()
const loginAction = computed(() => `${req.origin}/__login`)
const error = computed(() => (route.query.error ? '账号不存在或密码错误' : ''))
</script>
