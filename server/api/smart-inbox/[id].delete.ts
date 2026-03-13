import { eq } from 'drizzle-orm'
import { getDb } from '../../db'
import { smartInboxItems, smartInboxResults } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const db = getDb()

  const existing = db.select({ id: smartInboxItems.id }).from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()
  if (!existing) throw createError({ statusCode: 404, message: 'Smart inbox not found' })

  db.delete(smartInboxResults).where(eq(smartInboxResults.itemId, id)).run()
  db.delete(smartInboxItems).where(eq(smartInboxItems.id, id)).run()

  return { success: true }
})
