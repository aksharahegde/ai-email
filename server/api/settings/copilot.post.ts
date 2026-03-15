import { eq } from 'drizzle-orm'
import { setSyncState } from '../../utils/sync'
import { getDb } from '../../db'
import { threadAiCache } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const body = await readBody<{ prompt: string }>(event)
  if (!body?.prompt?.trim()) {
    throw createError({ statusCode: 400, message: 'prompt required' })
  }

  await setSyncState('copilot_analysis_prompt', body.prompt.trim())

  // Invalidate all cached analyses so they re-run with the new prompt
  const db = getDb()
  db.delete(threadAiCache).where(eq(threadAiCache.type, 'analysis')).run()

  return { ok: true }
})
