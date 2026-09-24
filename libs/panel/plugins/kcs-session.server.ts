export default defineNuxtPlugin(async () => {
  const { user, refresh, hasSession } = useSession()
  if (hasSession.value && !user.value) await refresh()
})
