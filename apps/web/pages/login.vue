<template>
  <div>
    <div class="login-switch">
      <button class="btn ghost desk-toggle" type="button" @click="desk = 'ops'">{{ t('loginDesk.switchOps') }}</button>
      <button class="btn ghost desk-toggle" type="button" @click="desk = 'select'">{{ t('loginDesk.switchSelect') }}</button>
    </div>

    <div v-if="desk === 'ops'" class="login-a" data-testid="screen-a-login">
      <aside class="login-a-rail">
        <strong>{{ t('brand') }}</strong>
        <span class="muted">{{ t('loginDesk.opsRail') }}</span>
      </aside>
      <div class="login-a-body">
        <h1>{{ t('loginDesk.opsTitle') }}</h1>
        <p class="muted">{{ t('loginDesk.opsLead') }}</p>
        <form method="post" :action="loginAction" enctype="application/x-www-form-urlencoded">
          <input type="hidden" name="locale" :value="locale" />
          <label class="field">
            {{ t('loginDesk.workEmail') }}
            <input name="email" data-testid="login-email" type="email" autocomplete="username" />
          </label>
          <label class="field">
            {{ t('password') }}
            <input name="password" data-testid="login-password" type="password" autocomplete="current-password" />
          </label>
          <p v-if="error" class="err" data-testid="login-error">{{ error }}</p>
          <button class="btn" data-testid="login-submit" type="submit">{{ t('loginDesk.enterDesk') }}</button>
        </form>
        <p class="muted">{{ t('loginDesk.opsFoot') }}</p>
      </div>
    </div>

    <div v-else class="login-c" data-testid="screen-c-login">
      <p class="muted">{{ t('loginDesk.selectRail') }}</p>
      <h1>{{ t('loginDesk.selectTitle') }}</h1>
      <form method="post" :action="loginAction" enctype="application/x-www-form-urlencoded">
        <input type="hidden" name="locale" :value="locale" />
        <label class="field">
          {{ t('loginDesk.companyEmail') }}
          <input name="email" data-testid="login-email" type="email" autocomplete="username" />
        </label>
        <label class="field">
          {{ t('password') }}
          <input name="password" data-testid="login-password" type="password" autocomplete="current-password" />
        </label>
        <label class="field inline">
          <input type="checkbox" />
          <span>{{ t('loginDesk.remember') }}</span>
        </label>
        <p v-if="error" class="err" data-testid="login-error">{{ error }}</p>
        <button class="btn" data-testid="login-submit" type="submit">{{ t('loginDesk.enterProject') }}</button>
      </form>
      <p class="muted">{{ t('loginDesk.selectFoot') }}</p>
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
const desk = ref(route.query.desk === 'select' || route.query.workspace === 'c' ? 'select' : 'ops')
</script>
