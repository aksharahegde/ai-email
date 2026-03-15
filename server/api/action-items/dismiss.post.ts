import { getDb } from '../../db'
import { actionItemStates } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const body = await readBody<{ threadId: string, itemText: string }>(event)
  if (!body?.threadId || !body?.itemText) {
    throw createError({ statusCode: 400, message: 'threadId and itemText required' })
  }

  const db = getDb()
  db.insert(actionItemStates).values({
    threadId: body.threadId,
    itemText: body.itemText,
    dismissed: 1,
    createdAt: Math.floor(Date.now() / 1000)
  }).onConflictDoUpdate({
    target: [actionItemStates.threadId, actionItemStates.itemText],
    set: { dismissed: 1 }
  }).run()

  return { ok: true }
})
