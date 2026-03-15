import { eq } from 'drizzle-orm'
import { getDb } from '../../db'
import { actionItemStates } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const threadId = getQuery(event).threadId as string
  if (!threadId) throw createError({ statusCode: 400, message: 'threadId required' })

  const db = getDb()
  const rows = db.select({
    itemText: actionItemStates.itemText,
    dismissed: actionItemStates.dismissed,
    taskId: actionItemStates.taskId
  })
    .from(actionItemStates)
    .where(eq(actionItemStates.threadId, threadId))
    .all()

  // Return as a map keyed by itemText for easy lookup
  const states: Record<string, { dismissed: boolean, taskId: string | null }> = {}
  for (const row of rows) {
    states[row.itemText] = { dismissed: row.dismissed === 1, taskId: row.taskId }
  }

  return { states }
})
