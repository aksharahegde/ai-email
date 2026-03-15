import { getSyncState, setSyncState } from '../../utils/sync'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const body = await readBody<{
    provider?: string
    model?: string
    ollamaUrl?: string
    apiKey?: string
  }>(event)

  const raw = await getSyncState('ai_settings')
  const existing = raw ? (() => { try { return JSON.parse(raw) } catch { return {} } })() : {}

  const aiSettings = {
    ...existing,
    ...(body?.provider != null && { provider: body.provider }),
    ...(body?.model != null && { model: body.model }),
    ...(body?.ollamaUrl != null && { ollamaUrl: body.ollamaUrl }),
    ...(body?.apiKey != null && body.apiKey !== '' && { apiKey: body.apiKey })
  }

  await setSyncState('ai_settings', JSON.stringify(aiSettings))
  return aiSettings
})
