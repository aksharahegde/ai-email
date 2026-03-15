import { getSyncState } from '../../utils/sync'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const raw = await getSyncState('ai_settings')
  if (raw) {
    try { return JSON.parse(raw) } catch {}
  }

  return {
    provider: 'ollama',
    model: 'llama3.2',
    ollamaUrl: 'http://localhost:11434'
  }
})
