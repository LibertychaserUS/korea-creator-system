<template>
  <nav
    v-if="items.length"
    class="flex items-center rounded-md border border-border bg-background p-0.5"
    :aria-label="t('kcs.nav.workspaces')"
  >
    <Button
      v-for="item in items"
      :key="item.key"
      as-child
      type="button"
      variant="ghost"
      size="sm"
      class="h-7 px-2.5 text-xs"
      :class="item.key === currentKey ? 'bg-muted text-foreground' : 'text-muted-foreground'"
    >
      <a :href="item.href" :data-testid="item.testid">
        {{ t(item.label) }}
      </a>
    </Button>
  </nav>
</template>

<script setup lang="ts">
import { can } from '@kcs/contract'

/**
 * 跨端切换：四个 app 各自独立源站（7000/7002/7003/7004），
 * 切换即跨源跳转，URL 取自 runtimeConfig.public（可用环境变量覆盖）。
 */
const { t, locale } = useI18n()
const { user } = useSession()
const config = useRuntimeConfig()
const kcs = useAppConfig().kcs as { key?: string } | undefined
const currentKey = computed(() => kcs?.key ?? '')

const catalog = computed(() => [
  { key: 'select', label: 'kcs.nav.select', testid: 'ws-switch-select', perm: 'select.read' as const, base: config.public.selectUrl as string },
  { key: 'ops', label: 'kcs.nav.ops', testid: 'ws-switch-ops', perm: 'ops.read' as const, base: config.public.opsUrl as string },
  { key: 'dev', label: 'kcs.nav.monitor', testid: 'ws-switch-dev', perm: 'dev.read' as const, base: config.public.devUrl as string },
])

const items = computed(() =>
  catalog.value
    .filter(item => !user.value || can(user.value.role, item.perm))
    .map(item => ({ ...item, href: `${item.base}/${locale.value}/` })),
)
</script>
