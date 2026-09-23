<template>
  <PanelPage :testid="TESTID.screenAccounts" :title="t('kcs.accounts.title')" :eyebrow="t('kcs.nav.monitor')" :lead="t('kcs.accounts.lead')">
    <template #actions>
      <Button :data-testid="TESTID.btnCreateAccount" @click="openCreate">
        <UserPlus class="size-4" />
        {{ t('kcs.accounts.create') }}
      </Button>
    </template>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="relative sm:w-72">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="q"
          type="search"
          class="h-9 pl-8"
          :placeholder="t('kcs.accounts.search')"
          :aria-label="t('kcs.accounts.search')"
          :data-testid="TESTID.accountSearch"
        />
      </div>
      <p class="flex items-start gap-1.5 text-xs text-muted-foreground sm:max-w-md sm:text-right">
        <Clock class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {{ t('kcs.accounts.delayNote') }}
      </p>
    </div>

    <div class="hidden md:block">
      <TableCard>
        <Table :data-testid="TESTID.tableAccounts">
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead>{{ t('kcs.accounts.cols.account') }}</TableHead>
              <TableHead class="w-56">{{ t('kcs.accounts.cols.role') }}</TableHead>
              <TableHead>
                <span :title="t('kcs.accounts.lastLoginHint')">{{ t('kcs.accounts.cols.lastLogin') }}</span>
              </TableHead>
              <TableHead>{{ t('kcs.accounts.cols.status') }}</TableHead>
              <TableHead class="text-right">{{ t('kcs.accounts.cols.actions') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="loading && !items.length">
              <TableRow v-for="i in 5" :key="`sk-${i}`" class="hover:bg-transparent">
                <TableCell><Skeleton class="h-4 w-48" /></TableCell>
                <TableCell><Skeleton class="h-8 w-44" /></TableCell>
                <TableCell><Skeleton class="h-4 w-28" /></TableCell>
                <TableCell><Skeleton class="h-5 w-14" /></TableCell>
                <TableCell><Skeleton class="ml-auto h-8 w-16" /></TableCell>
              </TableRow>
            </template>
            <TableRow
              v-for="a in filtered"
              :key="a.id"
              :data-testid="TESTID.rowAccount"
              :data-account-email="a.email"
              :class="a.disabled ? 'opacity-70' : ''"
            >
              <TableCell>
                <div class="flex items-center gap-3">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary" aria-hidden="true">
                    {{ initialOf(a) }}
                  </span>
                  <div class="min-w-0">
                    <p class="flex max-w-72 items-center gap-1.5 truncate font-medium text-foreground">
                      <span class="truncate">{{ a.name }}</span>
                      <span v-if="a.self" class="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-normal text-muted-foreground">{{ t('kcs.accounts.you') }}</span>
                    </p>
                    <p class="max-w-72 truncate text-[11px] text-muted-foreground">{{ a.email }}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <RoleSelect :account="a" />
              </TableCell>
              <TableCell class="text-xs tabular-nums text-muted-foreground">{{ lastLoginText(a) }}</TableCell>
              <TableCell>
                <AccountStatus :account="a" />
              </TableCell>
              <TableCell class="text-right">
                <AccountAction :account="a" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <EmptyState v-if="!loading && !filtered.length" :title="t('kcs.accounts.empty')" :icon="Users" />
      </TableCard>
    </div>

    <!-- 手机：卡片 -->
    <div class="flex flex-col gap-3 md:hidden">
      <template v-if="loading && !items.length">
        <Skeleton v-for="i in 3" :key="`msk-${i}`" class="h-32 rounded-xl" />
      </template>
      <div
        v-for="a in filtered"
        :key="a.id"
        class="rounded-xl border border-border/60 bg-card p-4 shadow-xs"
        :class="a.disabled ? 'opacity-70' : ''"
        :data-testid="TESTID.cardAccount"
        :data-account-email="a.email"
      >
        <div class="flex items-start gap-3">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary" aria-hidden="true">
            {{ initialOf(a) }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
                <span class="truncate">{{ a.name }}</span>
                <span v-if="a.self" class="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-normal text-muted-foreground">{{ t('kcs.accounts.you') }}</span>
              </p>
              <AccountStatus :account="a" class="shrink-0" />
            </div>
            <p class="truncate text-[11px] text-muted-foreground">{{ a.email }}</p>
            <p class="mt-1 text-[11px] tabular-nums text-muted-foreground">
              <template v-if="a.lastLoginAt">{{ t('kcs.accounts.cols.lastLogin') }} {{ lastLoginText(a) }}</template>
              <template v-else>{{ t('kcs.accounts.never') }}</template>
            </p>
          </div>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <RoleSelect :account="a" class="flex-1" />
          <AccountAction :account="a" />
        </div>
      </div>
      <EmptyState v-if="!loading && !filtered.length" :title="t('kcs.accounts.empty')" :icon="Users" />
    </div>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <!-- 停用 / 恢复确认 -->
    <AlertDialog :open="Boolean(pending)" @update:open="(v: boolean) => { if (!v) pending = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ pending ? t(`kcs.accounts.${pending.disable ? 'disable' : 'enable'}Title`, { name: pending.account.name }) : '' }}</AlertDialogTitle>
          <AlertDialogDescription>{{ pending ? t(`kcs.accounts.${pending.disable ? 'disable' : 'enable'}Body`) : '' }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="acting">{{ t('kcs.accounts.cancel') }}</AlertDialogCancel>
          <Button :variant="pending?.disable ? 'destructive' : 'default'" :disabled="acting" :data-testid="TESTID.btnAccountConfirm" @click="confirmToggle">
            <Loader2 v-if="acting" class="size-4 animate-spin" />
            {{ t('kcs.accounts.confirm') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- 新建账号 -->
    <Sheet v-model:open="createOpen">
      <SheetContent side="right" class="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader class="border-b border-border/60 px-5 py-4">
          <SheetTitle>{{ t('kcs.accounts.createTitle') }}</SheetTitle>
          <SheetDescription>{{ t('kcs.accounts.createLead') }}</SheetDescription>
        </SheetHeader>
        <form class="flex flex-col gap-4 px-5 py-5" :data-testid="TESTID.formCreateAccount" novalidate @submit.prevent="submitCreate">
          <div class="grid gap-1.5">
            <Label for="acc-email">{{ t('kcs.accounts.email') }}</Label>
            <Input id="acc-email" v-model="form.email" type="email" name="email" autocomplete="off" required />
          </div>
          <div class="grid gap-1.5">
            <Label for="acc-name">{{ t('kcs.accounts.name') }}</Label>
            <Input id="acc-name" v-model="form.name" name="name" autocomplete="off" :placeholder="t('kcs.accounts.namePlaceholder')" />
          </div>
          <div class="grid gap-1.5">
            <Label for="acc-password">{{ t('kcs.accounts.password') }}</Label>
            <Input id="acc-password" v-model="form.password" type="password" name="password" autocomplete="new-password" minlength="8" required />
            <p class="text-[11px] text-muted-foreground">{{ t('kcs.accounts.passwordHint') }}</p>
          </div>
          <div class="grid gap-1.5">
            <Label for="acc-role">{{ t('kcs.accounts.role') }}</Label>
            <div class="relative">
              <select id="acc-role" v-model="form.role" name="role" :class="SELECT_CLASS" required>
                <option v-for="role in ROLES" :key="role" :value="role">{{ t(`kcs.roles.${role}`) }}</option>
              </select>
              <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <p v-if="formError" class="text-sm text-destructive" role="alert">{{ formError }}</p>
          <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" :disabled="creating" @click="createOpen = false">{{ t('kcs.accounts.cancel') }}</Button>
            <Button type="submit" :disabled="creating" :data-testid="TESTID.btnCreateAccountSubmit">
              <Loader2 v-if="creating" class="size-4 animate-spin" />
              {{ t('kcs.accounts.submit') }}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  </PanelPage>
</template>

<script setup lang="ts">
import { ChevronDown, Clock, Loader2, Search, UserPlus, Users } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { ROLES, TESTID, type Role } from '@kcs/contract'
import { Button } from '#components'

type Account = {
  id: string
  email: string
  name: string
  role: Role | null
  disabled: boolean
  self: boolean
  createdAt: string | null
  lastLoginAt: string | null
}

const SELECT_CLASS =
  'border-input h-9 w-full appearance-none rounded-md border bg-transparent pl-3 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30'

const { t, te, locale } = useI18n()
const { request } = useApi()

const items = ref<Account[]>([])
const loading = ref(true)
const error = ref('')
const q = ref('')
const saving = ref<string | null>(null)
const pending = ref<{ account: Account; disable: boolean } | null>(null)
const acting = ref(false)

const createOpen = ref(false)
const creating = ref(false)
const formError = ref('')
const form = reactive({ email: '', name: '', password: '', role: 'selector' as Role })

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  if (!needle) return items.value
  return items.value.filter((a) => a.email.toLowerCase().includes(needle) || a.name.toLowerCase().includes(needle))
})

function initialOf(a: Account) {
  return (a.name || a.email).trim().charAt(0).toUpperCase()
}
function lastLoginText(a: Account) {
  if (!a.lastLoginAt) return t('kcs.accounts.never')
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(a.lastLoginAt))
}
function roleName(role: Role) {
  return t(`kcs.roles.${role}`)
}
function errorText(e: unknown) {
  const code = e instanceof Error ? e.message : ''
  const key = `kcs.accounts.errors.${code}`
  return te(key) ? t(key) : t('kcs.accounts.errors.failed')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await request<{ items: Account[] }>('/api/kcs-admin/users', {}, 'self')
    items.value = res.items ?? []
  } catch {
    error.value = t('kcs.panel.error')
  } finally {
    loading.value = false
  }
}

function patch(id: string, body: Record<string, unknown>) {
  return request<Account>(`/api/kcs-admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }, 'self')
}

async function changeRole(a: Account, next: Role) {
  if (next === a.role) return
  saving.value = a.id
  try {
    const updated = await patch(a.id, { role: next })
    a.role = updated.role
    toast.success(t('kcs.accounts.roleChanged', { name: a.name, role: roleName(next) }))
  } catch (e) {
    toast.error(errorText(e))
  } finally {
    saving.value = null
  }
}

async function confirmToggle() {
  if (!pending.value) return
  const { account, disable } = pending.value
  acting.value = true
  try {
    const updated = await patch(account.id, { disabled: disable })
    account.disabled = updated.disabled
    toast.success(t(disable ? 'kcs.accounts.disabled' : 'kcs.accounts.enabled', { name: account.name }))
    pending.value = null
  } catch (e) {
    toast.error(errorText(e))
  } finally {
    acting.value = false
  }
}

function openCreate() {
  Object.assign(form, { email: '', name: '', password: '', role: 'selector' })
  formError.value = ''
  createOpen.value = true
}

async function submitCreate() {
  formError.value = ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    formError.value = t('kcs.accounts.errors.invalid_email')
    return
  }
  if (form.password.length < 8) {
    formError.value = t('kcs.accounts.errors.weak_password')
    return
  }
  creating.value = true
  try {
    const created = await request<{ email: string }>(
      '/api/kcs-admin/users',
      { method: 'POST', body: JSON.stringify({ ...form }) },
      'self',
    )
    toast.success(t('kcs.accounts.created', { email: created.email }))
    createOpen.value = false
    await load()
  } catch (e) {
    formError.value = errorText(e)
  } finally {
    creating.value = false
  }
}

const RoleSelect = defineComponent({
  props: { account: { type: Object as PropType<Account>, required: true } },
  setup(props, { attrs }) {
    return () =>
      h('div', { class: ['relative', attrs.class] }, [
        h(
          'select',
          {
            class: SELECT_CLASS,
            value: props.account.role ?? '',
            disabled: props.account.self || saving.value === props.account.id,
            'aria-label': t('kcs.accounts.role'),
            'data-testid': TESTID.accountRole,
            onChange: (event: Event) => changeRole(props.account, (event.target as HTMLSelectElement).value as Role),
          },
          [
            props.account.role ? null : h('option', { value: '', disabled: true }, t('kcs.accounts.noRole')),
            ...ROLES.map((role) => h('option', { value: role }, roleName(role))),
          ],
        ),
        h(ChevronDown, { class: 'pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' }),
      ])
  },
})

const AccountStatus = defineComponent({
  props: { account: { type: Object as PropType<Account>, required: true } },
  setup(props, { attrs }) {
    return () =>
      h(
        'span',
        {
          class: [
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
            props.account.disabled
              ? 'border-border bg-muted text-muted-foreground'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            attrs.class,
          ],
          'data-testid': TESTID.accountStatus,
          'data-status': props.account.disabled ? 'disabled' : 'active',
        },
        t(`kcs.accounts.status.${props.account.disabled ? 'disabled' : 'active'}`),
      )
  },
})

const AccountAction = defineComponent({
  props: { account: { type: Object as PropType<Account>, required: true } },
  setup(props) {
    return () =>
      props.account.self
        ? null
        : h(
            Button,
            {
              variant: 'outline',
              size: 'sm',
              class: props.account.disabled ? '' : 'text-destructive hover:text-destructive',
              'data-testid': props.account.disabled ? TESTID.btnEnableAccount : TESTID.btnDisableAccount,
              onClick: () => {
                pending.value = { account: props.account, disable: !props.account.disabled }
              },
            },
            () => t(props.account.disabled ? 'kcs.accounts.enable' : 'kcs.accounts.disable'),
          )
  },
})

onMounted(load)
</script>
