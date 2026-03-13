import { eq } from 'drizzle-orm'
import { getDb } from '../../db'
import { threads, messages } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Thread ID required' })

  const db = getDb()

  const thread = db.select().from(threads).where(eq(threads.id, id)).get()
  if (!thread) throw createError({ statusCode: 404, message: 'Thread not found' })

  const msgs = db.select().from(messages)
    .where(eq(messages.threadId, id))
    .orderBy(messages.timestamp)
    .all()

  return {
    id: thread.id,
    subject: thread.subject,
    participants: JSON.parse(thread.participants),
    messages: msgs.map(m => ({
      id: m.id,
      threadId: m.threadId,
      from: JSON.parse(m.from),
      to: JSON.parse(m.to),
      cc: m.cc ? JSON.parse(m.cc) : undefined,
      subject: m.subject,
      body: m.body,
      timestamp: new Date(m.timestamp * 1000)
    }))
  }
})
