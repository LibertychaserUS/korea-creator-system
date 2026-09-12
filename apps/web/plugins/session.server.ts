export default defineNuxtPlugin(async () => {
  const { user, refresh, token } = useSession()
  if (token.value && !user.value) await refresh()
})
