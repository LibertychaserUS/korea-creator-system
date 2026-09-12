<template>
  <div class="login-card" data-testid="screen-a-login">
    <div data-testid="screen-c-login">
      <h1>{{ t('brand') }}</h1>
      <form @submit.prevent="submit">
        <label class="field">
          {{ t('email') }}
          <input v-model="email" data-testid="auth-email" type="email" autocomplete="username" />
        </label>
        <label class="field">
          {{ t('password') }}
          <input v-model="password" data-testid="auth-password" type="password" autocomplete="current-password" />
        </label>
        <p v-if="error" class="err" data-testid="login-error">{{ error }}</p>
        <button class="btn" data-testid="auth-submit" type="submit">{{ t('login') }}</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { homeFor } from '~/utils/nav'

definePageMeta({ layout: 'auth' })
const { t } = useI18n()
const { request, token } = useApi()
const { user } = useSession()
const email = ref('')
const password = ref('')
const error = ref('')

async function submit() {
  error.value = ''
  try {
    const data = await request<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.value, password: password.value }),
    })
    token.value = data.token
    user.value = data.user
    await navigateTo(homeFor(data.user.role))
  } catch {
    error.value = '账号不存在或密码错误'
  }
}
</script>
