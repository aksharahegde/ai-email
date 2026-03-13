export default defineNuxtRouteMiddleware(async (to) => {
  const publicPaths = ['/', '/auth']
  if (publicPaths.some(p => to.path === p || to.path.startsWith(`${p}/`))) {
    return
  }

  const { loggedIn, fetch } = useUserSession()
  await fetch()

  if (!loggedIn.value && to.path !== '/') {
    return navigateTo('/')
  }
})
