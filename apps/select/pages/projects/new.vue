<template>
  <PanelPage testid="screen-c-project-new" :title="t('kcs.panel.createProject')" :eyebrow="t('kcs.nav.select')">
    <template #actions>
      <Button as-child variant="outline" size="sm">
        <NuxtLink :to="localePath('/projects')">
          <ArrowLeft class="size-4" />
          {{ t('kcs.panel.projects') }}
        </NuxtLink>
      </Button>
    </template>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card class="gap-0 border-border/60 py-0 shadow-xs">
        <form class="grid gap-5 p-5 sm:p-6" @submit.prevent="save">
          <div class="grid gap-2">
            <Label for="project-name" class="flex items-center justify-between">
              <span>{{ t('kcs.panel.projectName') }}</span>
              <span class="text-[11px] font-normal text-muted-foreground">{{ t('kcs.panel.required') }}</span>
            </Label>
            <Input
              id="project-name"
              v-model="name"
              data-testid="project-name"
              required
              autofocus
              maxlength="80"
              class="h-10 text-base"
            />
          </div>
          <div class="grid gap-2">
            <Label for="project-note" class="flex items-center justify-between">
              <span>{{ t('kcs.panel.note') }}</span>
              <span class="text-[11px] font-normal tabular-nums text-muted-foreground">{{ note.length }} / 500</span>
            </Label>
            <Textarea id="project-note" v-model="note" rows="4" maxlength="500" class="resize-none" />
          </div>
          <p v-if="error" class="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle class="size-4" />
            {{ t('kcs.panel.error') }}
          </p>
          <div class="flex items-center gap-2 border-t border-border/60 pt-5">
            <Button data-testid="btn-create-project" type="submit" :disabled="!name.trim() || saving">
              <Loader2 v-if="saving" class="size-4 animate-spin" />
              <Plus v-else class="size-4" />
              {{ t('kcs.panel.createProject') }}
            </Button>
            <Button as-child variant="ghost" type="button">
              <NuxtLink :to="localePath('/projects')">{{ t('kcs.panel.back') }}</NuxtLink>
            </Button>
          </div>
        </form>
      </Card>

      <!-- 右侧预览：新建时就看到项目卡的样子 -->
      <aside class="space-y-3">
        <p class="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{{ t('kcs.panel.preview') }}</p>
        <Card class="gap-0 border-border/60 py-0 shadow-xs">
          <div class="flex items-start gap-3 p-4">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
              <FolderKanban class="size-4" />
            </span>
            <div class="min-w-0">
              <p class="truncate font-medium text-foreground">{{ name.trim() || t('kcs.panel.untitled') }}</p>
              <p class="mt-0.5 line-clamp-3 text-sm text-muted-foreground">{{ note.trim() || t('kcs.panel.note') }}</p>
            </div>
          </div>
          <div class="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
            <span>{{ t('kcs.panel.members') }}</span>
            <span class="tabular-nums">0</span>
          </div>
        </Card>
        <p class="text-xs leading-relaxed text-muted-foreground">{{ t('kcs.panel.assignHint') }}</p>
      </aside>
    </div>
  </PanelPage>
</template>

<script setup lang="ts">
import { AlertCircle, ArrowLeft, FolderKanban, Loader2, Plus } from 'lucide-vue-next'

const { t } = useI18n()
const { request } = useApi()
const localePath = useLocalePath()
const name = ref('')
const note = ref('')
const saving = ref(false)
const error = ref(false)

async function save() {
  if (!name.value.trim()) return
  saving.value = true
  error.value = false
  try {
    const data = await request<{ id: string }>('/api/select/projects', {
      method: 'POST',
      body: JSON.stringify({ name: name.value.trim(), note: note.value.trim() }),
    })
    await navigateTo(localePath(`/projects/${data.id}`))
  } catch {
    error.value = true
  } finally {
    saving.value = false
  }
}
</script>
