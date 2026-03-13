import { eq } from 'drizzle-orm'
import { getDb } from '../../db'
import { smartInboxItems, smartInboxResults } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const body = await readBody(event)
  const db = getDb()

  const existing = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()
  if (!existing) throw createError({ statusCode: 404, message: 'Smart inbox not found' })

  const scanScope = [50, 200, 500].includes(Number(body.scanScope)) ? Number(body.scanScope) : existing.scanScope

  // Update item and invalidate classification
  db.update(smartInboxItems).set({
    name: body.name ? String(body.name) : existing.name,
    classificationPrompt: body.classificationPrompt ? String(body.classificationPrompt) : existing.classificationPrompt,
    summarizationPrompt: body.summarizationPrompt !== undefined
      ? (body.summarizationPrompt ? String(body.summarizationPrompt) : null)
      : existing.summarizationPrompt,
    scanScope,
    lastClassifiedAt: null // force re-classification
  }).where(eq(smartInboxItems.id, id)).run()

  // Delete all cached results so re-classification starts fresh
  db.delete(smartInboxResults).where(eq(smartInboxResults.itemId, id)).run()

  const item = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()
  return { item }
})
