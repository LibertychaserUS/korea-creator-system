<template>
  <div
    v-if="show"
    data-testid="cookie-consent"
    class="fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
    role="dialog"
    :aria-label="t('kcs.prefs.consentTitle')"
  >
    <Card class="mx-auto max-w-2xl border-border/60 shadow-lg">
      <CardContent class="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-foreground">{{ t('kcs.prefs.consentTitle') }}</p>
          <p class="mt-1 text-xs leading-relaxed text-muted-foreground">{{ t('kcs.prefs.consentBody') }}</p>
        </div>
        <div class="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="consent-necessary"
            @click="choose('necessary')"
          >
            {{ t('kcs.prefs.consentNecessary') }}
          </Button>
          <Button
            size="sm"
            data-testid="consent-preferences"
            @click="choose('all')"
          >
            {{ t('kcs.prefs.consentPreferences') }}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { decided, choose } = useConsent()

// Only render after hydration so SSR HTML does not flash the banner.
const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})
const show = computed(() => hydrated.value && !decided.value)
</script>
