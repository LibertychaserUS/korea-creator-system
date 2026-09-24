<template>
  <PanelPage
    :testid="SCREEN_TESTID['B-i18n-theme']"
    :title="t('kcs.console.i18n.title')"
    :eyebrow="t('kcs.nav.monitor')"
    :lead="t('kcs.console.i18n.lead')"
  >
    <template #actions>
      <span v-if="report" class="text-xs text-muted-foreground">{{ t('kcs.console.i18n.checkedAt', { time: formatDateTime(report.checkedAt) }) }}</span>
    </template>

    <div class="grid gap-6 lg:grid-cols-2">
      <Card
        v-for="block in blocks"
        :key="block.id"
        class="gap-0 border-border/60 py-0 shadow-xs"
        :data-testid="`i18n-${block.id}`"
        :data-ok="block.check ? String(block.check.ok) : ''"
      >
        <div class="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5">
          <div>
            <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ block.title }}</h2>
            <p v-if="block.check" class="mt-0.5 text-xs text-muted-foreground">
              {{ t('kcs.console.i18n.reference', { locale: localeName(block.check.reference) }) }}
            </p>
          </div>
          <Badge v-if="block.check" variant="outline" :class="block.check.ok ? okTone : warnTone">
            <CheckCircle2 v-if="block.check.ok" class="size-3.5" aria-hidden="true" />
            <AlertTriangle v-else class="size-3.5" aria-hidden="true" />
            {{ block.check.ok ? t('kcs.console.i18n.ok') : t('kcs.console.i18n.problems', { n: problemCount(block.check) }) }}
          </Badge>
          <Skeleton v-else class="h-5 w-16" />
        </div>
        <ul v-if="block.check" class="divide-y divide-border/60">
          <li v-for="row in block.check.locales" :key="row.locale" class="px-4 py-3" :data-locale="row.locale">
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class="font-medium text-foreground">{{ localeName(row.locale) }}</span>
              <span class="text-xs tabular-nums text-muted-foreground">{{ t('kcs.console.i18n.keys', { n: formatNumber(row.keys) }) }}</span>
            </div>
            <div v-for="kind in KINDS" v-show="row[kind].length" :key="kind" class="mt-2">
              <p class="text-xs font-medium text-amber-700 dark:text-amber-300">
                {{ t(`kcs.console.i18n.${kind === 'placeholderMismatch' ? 'placeholder' : kind}`) }} · {{ formatNumber(row[kind].length) }}
              </p>
              <ul class="mt-1 space-y-0.5 font-mono text-[11px] text-muted-foreground">
                <li v-for="key in row[kind].slice(0, 8)" :key="key" class="truncate" :title="key">{{ key }}</li>
                <li v-if="row[kind].length > 8" class="font-sans">{{ t('kcs.console.i18n.more', { n: row[kind].length - 8 }) }}</li>
              </ul>
            </div>
          </li>
        </ul>
      </Card>
    </div>

    <Card class="gap-0 border-border/60 py-0 shadow-xs" data-testid="i18n-themes">
      <div class="border-b border-border/60 px-4 py-3.5">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">{{ t('kcs.console.i18n.themes') }}</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">{{ t('kcs.console.i18n.themesLead') }}</p>
      </div>
      <div class="flex flex-wrap gap-2 p-4" role="radiogroup" :aria-label="t('kcs.console.i18n.themes')">
        <button
          v-for="name in themes"
          :key="name"
          type="button"
          role="radio"
          :aria-checked="current === name"
          class="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          :class="current === name ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'"
          :data-theme-option="name"
          @click="setTheme(name as any)"
        >
          <component :is="themeIcon(name)" class="size-4" aria-hidden="true" />
          {{ themeName(name) }}
          <span v-if="current === name" class="text-[11px] text-primary">· {{ t('kcs.console.i18n.current') }}</span>
        </button>
      </div>
    </Card>
  </PanelPage>
</template>

<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Monitor, Moon, Sun } from 'lucide-vue-next'
import { API, SCREEN_TESTID, checkLocaleKeys, type DevI18nReport, type LocaleCheck } from '@kcs/contract'
import { enKcs } from '@libs/i18n/locales/kcs/en'
import { koKcs } from '@libs/i18n/locales/kcs/ko'
import { zhCNKcs } from '@libs/i18n/locales/kcs/zh-CN'

const KINDS = ['missing', 'extra', 'empty', 'placeholderMismatch'] as const

const { t, te } = useI18n()
const { request } = useApi()
const { formatNumber, formatDateTime } = useFormat()
const { theme, setTheme, isHydrated } = useTheme()
// 服务端不知道本机存的配色，水合前不标当前项
const current = computed(() => (isHydrated.value ? theme.value : null))

const report = ref<DevI18nReport | null>(null)

/**
 * 界面文案随页面打包，直接在浏览器里对；导出表头由接口生成，交给接口对。
 * 平时每端只加载当前语言，这一页要三种都在，所以直接引入三份。
 */
const screenCheck = computed<LocaleCheck>(() => checkLocaleKeys({ 'zh-CN': zhCNKcs, en: enKcs, ko: koKcs }, 'zh-CN'))

const blocks = computed(() => [
  { id: 'screen', title: t('kcs.console.i18n.screen'), check: screenCheck.value },
  { id: 'export', title: t('kcs.console.i18n.export'), check: report.value?.exportLabels ?? null },
])

const themes = computed(() => report.value?.themes ?? ['light', 'dark', 'system'])

const okTone = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
const warnTone = 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'

function problemCount(check: LocaleCheck): number {
  return check.locales.reduce((n, row) => n + row.missing.length + row.extra.length + row.empty.length + row.placeholderMismatch.length, 0)
}

function localeName(code: string): string {
  const key = `kcs.console.i18n.locales.${code === 'zh-CN' ? 'zh' : code}`
  return te(key) ? t(key) : code
}

function themeName(name: string): string {
  const key = `kcs.console.i18n.themeNames.${name}`
  return te(key) ? t(key) : name
}

const themeIcon = (name: string) => (name === 'dark' ? Moon : name === 'light' ? Sun : Monitor)

onMounted(async () => {
  report.value = await request<DevI18nReport>(API.devI18n.path).catch(() => null)
})
</script>
