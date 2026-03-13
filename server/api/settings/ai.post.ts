export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody<{
    provider?: string
    model?: string
    ollamaUrl?: string
    apiKey?: string
  }>(event)

  const aiSettings = {
    ...((session as { aiSettings?: Record<string, unknown> })?.aiSettings ?? {}),
    ...(body?.provider != null && { provider: body.provider }),
    ...(body?.model != null && { model: body.model }),
    ...(body?.ollamaUrl != null && { ollamaUrl: body.ollamaUrl }),
    ...(body?.apiKey != null && body.apiKey !== '' && { apiKey: body.apiKey })
  }

  await setUserSession(event, { ...session, aiSettings })
  return aiSettings
})
