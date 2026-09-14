<template>
  <DropdownMenu>
    <div data-testid="locale-switch" :aria-label="t('kcs.toolbar.language')">
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="sm" class="h-8 px-2 text-xs" data-testid="locale-switch-trigger">
          <LanguagesIcon class="mr-1.5 h-4 w-4" />
          {{ currentName }}
        </Button>
      </DropdownMenuTrigger>
    </div>
    <DropdownMenuContent align="end">
      <DropdownMenuItem
        v-for="item in localeItems"
        :key="item.code"
        :data-testid="`locale-option-${item.code}`"
        @click="changeLanguage(item.code)"
      >
        <span>{{ item.name }}</span>
        <CheckIcon v-if="locale === item.code" class="ml-auto h-4 w-4" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { CheckIcon, LanguagesIcon } from 'lucide-vue-next'

const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const localeItems = computed(() =>
  locales.value.map(item => ({
    code: String(item.code),
    name: item.name || String(item.code),
  })),
)

const currentName = computed(() => localeItems.value.find(i => i.code === locale.value)?.name || locale.value)

const changeLanguage = (target: string) => {
  const path = switchLocalePath(target as 'en' | 'zh-CN' | 'ko')
  if (path) navigateTo(path)
}
</script>
