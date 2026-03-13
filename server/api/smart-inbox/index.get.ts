import { desc } from 'drizzle-orm'
import { getDb } from '../../db'
import { smartInboxItems } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const db = getDb()
  const items = db.select().from(smartInboxItems).orderBy(desc(smartInboxItems.createdAt)).all()
  return { items }
})
