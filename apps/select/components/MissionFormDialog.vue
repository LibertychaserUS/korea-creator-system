<template>
  <Dialog :open="open" @update:open="(v: boolean) => emit('update:open', v)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ mission ? t('kcs.missions.editTitle', { name: mission.name }) : t('kcs.missions.createTitle') }}</DialogTitle>
        <DialogDescription>{{ t('kcs.missions.briefOptional') }}</DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-1.5">
          <Label for="mission-name">{{ t('kcs.missions.name') }}</Label>
          <Input id="mission-name" v-model="form.name" :placeholder="t('kcs.missions.namePlaceholder')" data-testid="input-mission-name" @keyup.enter="submit" />
          <p v-if="nameError" role="alert" class="text-xs text-destructive" data-testid="mission-name-error">{{ nameError }}</p>
        </div>

        <div class="space-y-1.5">
          <Label for="mission-note">{{ t('kcs.missions.note') }}</Label>
          <Input id="mission-note" v-model="form.note" :placeholder="t('kcs.missions.notePlaceholder')" data-testid="input-mission-note" />
        </div>

        <div class="tide-rule" aria-hidden="true" />
        <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{{ t('kcs.missions.briefTitle') }}</p>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="mission-category">{{ t('kcs.missions.briefCategory') }}</Label>
            <Input id="mission-category" v-model="form.category" :placeholder="t('kcs.missions.briefCategoryPlaceholder')" data-testid="input-mission-category" />
          </div>
          <div class="space-y-1.5">
            <Label for="mission-target">{{ t('kcs.missions.briefTarget') }}</Label>
            <Input id="mission-target" v-model="form.targetCount" type="number" min="1" max="1000" step="1" :placeholder="t('kcs.missions.briefTargetPlaceholder')" class="tabular-nums" data-testid="input-mission-target" />
          </div>
          <div class="space-y-1.5">
            <Label for="mission-budget-min">{{ t('kcs.missions.briefBudgetMin') }}</Label>
            <Input id="mission-budget-min" v-model="form.budgetMin" type="number" min="0" step="1" :placeholder="t('kcs.missions.briefBudgetPlaceholder')" class="tabular-nums" data-testid="input-mission-budget-min" />
          </div>
          <div class="space-y-1.5">
            <Label for="mission-budget-max">{{ t('kcs.missions.briefBudgetMax') }}</Label>
            <Input id="mission-budget-max" v-model="form.budgetMax" type="number" min="0" step="1" :placeholder="t('kcs.missions.briefBudgetPlaceholder')" class="tabular-nums" data-testid="input-mission-budget-max" />
          </div>
          <div class="space-y-1.5">
            <Label for="mission-focus">{{ t('kcs.missions.briefFocus') }}</Label>
            <select id="mission-focus" v-model="form.focus" class="border-input h-9 w-full rounded-md border bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" data-testid="select-mission-focus">
              <option value="">{{ t('kcs.missions.briefNone') }}</option>
              <option value="reach">{{ t('kcs.missions.focus.reach') }}</option>
              <option value="cost">{{ t('kcs.missions.focus.cost') }}</option>
              <option value="balance">{{ t('kcs.missions.focus.balance') }}</option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label for="mission-deadline">{{ t('kcs.missions.briefDeadline') }}</Label>
            <Input id="mission-deadline" v-model="form.deadline" type="date" :placeholder="t('kcs.missions.deadlinePlaceholder')" class="tabular-nums" data-testid="input-mission-deadline" />
            <p class="text-[11px] text-muted-foreground">{{ t('kcs.missions.deadlineHint') }}</p>
          </div>
        </div>

        <p v-if="formError" role="alert" class="text-sm text-destructive" data-testid="mission-form-error">{{ formError }}</p>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="saving" data-testid="btn-mission-cancel" @click="emit('update:open', false)">
          {{ t('kcs.missions.form.cancel') }}
        </Button>
        <Button :disabled="saving" data-testid="btn-mission-save" @click="submit">
          <Loader2 v-if="saving" class="size-4 animate-spin" aria-hidden="true" />
          {{ saving ? t('kcs.missions.form.saving') : t('kcs.missions.form.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { apiPath } from '@kcs/contract'

/**
 * 新建 / 编辑选人任务共用的对话框。brief 字段全部可选：一个都没填时，
 * 新建不带 brief，编辑则传 brief: null 把旧简报清掉（与后端 PATCH 语义一致）。
 */
const props = defineProps<{ open: boolean; mission: any | null }>()
const emit = defineEmits<{ 'update:open': [boolean]; saved: [string] }>()

const { t } = useI18n()
const { request, errorText } = useApi()

const empty = () => ({ name: '', note: '', category: '', targetCount: '', budgetMin: '', budgetMax: '', focus: '', deadline: '' })
const form = reactive(empty())
const saving = ref(false)
const nameError = ref('')
const formError = ref('')

watch(
  () => props.open,
  (open) => {
    if (!open) return
    nameError.value = ''
    formError.value = ''
    const brief = props.mission?.brief ?? null
    Object.assign(form, empty(), {
      name: props.mission?.name ?? '',
      note: props.mission?.note ?? '',
      category: brief?.category ?? '',
      targetCount: brief?.targetCount != null ? String(brief.targetCount) : '',
      budgetMin: brief?.budgetMin != null ? String(brief.budgetMin) : '',
      budgetMax: brief?.budgetMax != null ? String(brief.budgetMax) : '',
      focus: brief?.focus ?? '',
      deadline: brief?.deadline ?? '',
    })
  },
)

function intOf(raw: string): number | undefined {
  if (raw === '') return undefined
  const n = Number(raw)
  return Number.isInteger(n) ? n : undefined
}

/** 组装 brief：只带有值的字段；全空返回 null（编辑时 = 清空简报）。 */
function briefPayload(): Record<string, unknown> | null {
  const brief: Record<string, unknown> = {}
  if (form.category.trim()) brief.category = form.category.trim()
  const targetCount = intOf(form.targetCount)
  if (targetCount != null) brief.targetCount = targetCount
  const budgetMin = intOf(form.budgetMin)
  if (budgetMin != null) brief.budgetMin = budgetMin
  const budgetMax = intOf(form.budgetMax)
  if (budgetMax != null) brief.budgetMax = budgetMax
  if (form.focus) brief.focus = form.focus
  if (form.deadline) brief.deadline = form.deadline
  return Object.keys(brief).length ? brief : null
}

async function submit() {
  nameError.value = ''
  formError.value = ''
  if (!form.name.trim()) {
    nameError.value = t('kcs.missions.nameRequired')
    return
  }
  saving.value = true
  try {
    const editing = Boolean(props.mission?.id)
    const brief = briefPayload()
    const res = editing
      ? await request<any>(apiPath('/api/select/projects/:id', { id: props.mission.id }), {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name.trim(),
            note: form.note.trim() || null,
            brief,
          }),
        })
      : await request<any>('/api/select/projects', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            note: form.note.trim() || null,
            ...(brief ? { brief } : {}),
          }),
        })
    toast.success(editing ? t('kcs.missions.form.updated') : t('kcs.missions.form.created', { name: form.name.trim() }))
    emit('update:open', false)
    emit('saved', res?.id ?? props.mission?.id ?? '')
  } catch (e: unknown) {
    formError.value = errorText(e)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.tide-rule {
  height: 1px;
  background: linear-gradient(90deg, oklch(0.45 0.085 235 / 0.7), oklch(0.88 0.07 75 / 0.6) 60%, transparent);
}
</style>
