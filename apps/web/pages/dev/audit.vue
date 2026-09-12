<template>
  <ScreenFrame testid="screen-b-audit" :title="t('devDesk.audit')">
    <table class="ledger-table">
      <thead>
        <tr><th>time</th><th>action</th><th>target</th><th>审计</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.id">
          <td>{{ row.created_at }}</td>
          <td>{{ row.action }}</td>
          <td>{{ row.entity_type }} {{ row.entity_id }}</td>
          <td>{{ row.summary }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="!items.length" class="muted">{{ t('devDesk.audit') }}</p>
  </ScreenFrame>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { request } = useApi()
const items = ref<any[]>([])
onMounted(async () => {
  items.value = (await request<any>('/api/dev/audit')).items || []
})
</script>
