import { eq } from 'drizzle-orm'
import { getDb } from '../../db'
import { smartInboxItems } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const body = await readBody(event)

  if (!body.name || !body.classificationPrompt) {
    throw createError({ statusCode: 400, message: 'name and classificationPrompt are required' })
  }

  const scanScope = [50, 200, 500].includes(Number(body.scanScope)) ? Number(body.scanScope) : 50

  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  const db = getDb()

  db.insert(smartInboxItems).values({
    id,
    name: String(body.name),
    classificationPrompt: String(body.classificationPrompt),
    summarizationPrompt: body.summarizationPrompt ? String(body.summarizationPrompt) : null,
    scanScope,
    classifying: 0,
    lastClassifiedAt: null,
    createdAt: now
  }).run()

  const item = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()
  return { item }
})
