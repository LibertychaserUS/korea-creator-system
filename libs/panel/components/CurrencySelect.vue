<template>
  <DropdownMenu>
    <div data-testid="currency-switch" :aria-label="t('kcs.prefs.currency')">
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="sm" class="h-8 px-2 text-xs" data-testid="currency-switch-trigger">
          <CoinsIcon class="mr-1.5 h-4 w-4" />
          {{ currency }}
        </Button>
      </DropdownMenuTrigger>
    </div>
    <DropdownMenuContent align="end">
      <DropdownMenuItem
        v-for="code in DISPLAY_CURRENCIES"
        :key="code"
        :data-testid="`currency-option-${code}`"
        @click="setCurrency(code)"
      >
        <span class="mr-2 inline-block w-4 text-center text-muted-foreground">{{ symbols[code] }}</span>
        <span>{{ code }}</span>
        <CheckIcon v-if="currency === code" class="ml-auto h-4 w-4" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { CheckIcon, CoinsIcon } from 'lucide-vue-next'
import { DISPLAY_CURRENCIES, type DisplayCurrency } from '../composables/useCurrency'

const { t } = useI18n()
const { currency, setCurrency } = useCurrency()

const symbols: Record<DisplayCurrency, string> = {
  CNY: '¥',
  USD: '$',
  KRW: '₩',
}
</script>
