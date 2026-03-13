export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const aiSettings = (session as { aiSettings?: Record<string, unknown> })?.aiSettings
  return aiSettings ?? {
    provider: 'ollama',
    model: 'llama3.2',
    ollamaUrl: 'http://localhost:11434'
  }
})
