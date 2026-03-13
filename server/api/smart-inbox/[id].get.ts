import { eq } from 'drizzle-orm'
import { getDb } from '../../db'
import { smartInboxItems } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const db = getDb()
  const item = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()
  if (!item) throw createError({ statusCode: 404, message: 'Not found' })

  return { item }
})
