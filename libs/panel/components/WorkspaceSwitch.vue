<template>
  <nav
    v-if="items.length"
    class="flex items-center rounded-md border border-border bg-background p-0.5"
    :aria-label="t('kcs.nav.workspaces')"
  >
    <Button
      v-for="item in items"
      :key="item.to"
      as-child
      type="button"
      variant="ghost"
      size="sm"
      class="h-7 px-2.5 text-xs"
      :class="isActive(item.to) ? 'bg-muted text-foreground' : 'text-muted-foreground'"
    >
      <NuxtLink :to="localePath(item.to)" :data-testid="item.testid">
        {{ t(item.label) }}
      </NuxtLink>
    </Button>
  </nav>
</template>

<script setup lang="ts">
import { can } from '@kcs/contract'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { user } = useSession()

const catalog = [
  { to: '/select', label: 'kcs.nav.select', testid: 'ws-switch-select', perm: 'select.read' as const },
  { to: '/ops', label: 'kcs.nav.ops', testid: 'ws-switch-ops', perm: 'ops.read' as const },
  { to: '/dev', label: 'kcs.nav.monitor', testid: 'ws-switch-dev', perm: 'dev.read' as const },
]

const items = computed(() => {
  if (!user.value) return catalog
  return catalog.filter(item => can(user.value!.role, item.perm))
})

const barePath = computed(() => route.path.replace(/^\/(zh-CN|en|ko)/, '') || '/')
const isActive = (path: string) => barePath.value === path || barePath.value.startsWith(`${path}/`)
</script>
