<template>
  <PanelPage testid="screen-c-projects" :title="t('kcs.panel.projects')" :eyebrow="t('kcs.nav.select')">
    <template #actions>
      <Button as-child>
        <NuxtLink data-testid="btn-create-project" :to="localePath('/projects/new')">
          {{ t('kcs.panel.createProject') }}
        </NuxtLink>
      </Button>
    </template>

    <Card>
      <CardContent class="pt-6">
        <Table data-testid="table-projects">
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('kcs.panel.projects') }}</TableHead>
              <TableHead>n</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in items" :key="row.id">
              <TableCell>
                <NuxtLink class="font-medium hover:underline" :to="localePath(`/projects/${row.id}`)">
                  {{ row.name }}
                </NuxtLink>
              </TableCell>
              <TableCell>{{ row.member_count }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </PanelPage>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { request } = useApi()
const items = ref<any[]>([])

onMounted(async () => {
  items.value = (await request<any>('/api/select/projects')).items
})
</script>
