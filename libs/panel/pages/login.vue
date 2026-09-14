<template>
  <div class="auth-wide grid overflow-hidden rounded-xl border border-border/60 bg-card shadow-lg lg:grid-cols-[1.1fr_1fr]">
    <!-- 左：品牌叙事（仅桌面），深海底色，和潮声背景同一色系 -->
    <aside class="tide-login-aside relative hidden min-h-[560px] flex-col justify-between gap-10 overflow-hidden p-9 lg:flex" aria-hidden="true">
      <div class="tide-login-glow" />
      <div class="relative flex items-center gap-3">
        <AppLogo size="md" :show-text="false" icon-class-name="bg-white/10 ring-1 ring-white/15" />
        <div class="leading-tight">
          <p class="text-sm font-semibold text-white">{{ t('kcs.brand.title') }}</p>
          <p class="text-[11px] uppercase tracking-[0.16em] text-white/55">{{ t('kcs.brand.eyebrow') }}</p>
        </div>
      </div>

      <div class="relative space-y-4">
        <h2 class="text-3xl font-semibold leading-tight tracking-tight text-white">{{ t('kcs.brand.tagline') }}</h2>
        <p class="max-w-sm text-sm leading-relaxed text-white/70">{{ t('kcs.brand.story') }}</p>
      </div>

      <ul class="relative grid gap-3">
        <li v-for="ws in workspaces" :key="ws.key" class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-white">
            <component :is="ws.icon" class="size-4" />
          </span>
          <div class="min-w-0 leading-tight">
            <p class="text-sm font-medium text-white">{{ t(ws.label) }}</p>
            <p class="truncate text-xs text-white/60">{{ t(ws.desc) }}</p>
          </div>
        </li>
      </ul>
    </aside>

    <!-- 右：登录表单 -->
    <div class="flex flex-col justify-center p-6 sm:p-9">
      <div class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight text-foreground">{{ t('kcs.panel.signIn') }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('kcs.panel.signInLead') }}</p>
      </div>
      <form method="post" :action="loginAction" class="grid gap-4" enctype="application/x-www-form-urlencoded">
        <input type="hidden" name="locale" :value="locale" />
        <input type="hidden" name="app" :value="appKey" />
        <div class="grid gap-2">
          <Label for="email">{{ t('kcs.panel.email') }}</Label>
          <div class="relative">
            <Mail class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              data-testid="login-email"
              autocomplete="username"
              class="h-10 pl-9"
              :placeholder="t('kcs.panel.email')"
            />
          </div>
        </div>
        <div class="grid gap-2">
          <Label for="password">{{ t('kcs.panel.password') }}</Label>
          <div class="relative">
            <LockKeyhole class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type="password"
              data-testid="login-password"
              autocomplete="current-password"
              class="h-10 pl-9"
            />
          </div>
        </div>
        <p
          v-if="error"
          class="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid="login-error"
        >
          <AlertCircle class="size-4 shrink-0" />
          {{ error }}
        </p>
        <Button data-testid="login-submit" type="submit" class="mt-1 h-10 w-full">
          {{ t('kcs.panel.enter') }}
          <ArrowRight class="size-4" />
        </Button>
      </form>
      <p class="mt-8 text-center font-mono text-[11px] tracking-[0.2em] text-muted-foreground/80">{{ t('kcs.brand.pillars') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Activity, AlertCircle, ArrowRight, ClipboardList, LockKeyhole, Mail, Users } from 'lucide-vue-next'

definePageMeta({ layout: 'auth' })

const { t, locale } = useI18n()
const route = useRoute()
const req = useRequestURL()
const appKey = computed(() => String((useAppConfig().kcs as { key?: string } | undefined)?.key ?? ''))
const loginAction = computed(() => `${req.origin}/__login`)
const error = computed(() => (route.query.error ? t('kcs.panel.loginError') : ''))

const workspaces = [
  { key: 'ops', label: 'kcs.nav.ops', desc: 'kcs.panel.opsDesc', icon: ClipboardList },
  { key: 'select', label: 'kcs.nav.select', desc: 'kcs.panel.selectDesc', icon: Users },
  { key: 'dev', label: 'kcs.nav.monitor', desc: 'kcs.panel.devDesc', icon: Activity },
]
</script>

<style scoped>
.tide-login-aside {
  background:
    linear-gradient(160deg, oklch(0.36 0.06 215) 0%, oklch(0.26 0.05 235) 55%, oklch(0.2 0.04 250) 100%);
}

.tide-login-glow {
  position: absolute;
  inset: auto -30% -40% auto;
  width: 80%;
  aspect-ratio: 1;
  border-radius: 9999px;
  background: radial-gradient(circle, oklch(0.75 0.1 200 / 0.35) 0%, transparent 65%);
  filter: blur(40px);
  pointer-events: none;
}
</style>
