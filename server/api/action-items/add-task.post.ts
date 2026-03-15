import { getDb } from '../../db'
import { actionItemStates, emailTasks } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const body = await readBody<{ threadId: string, itemText: string, due?: string }>(event)
  if (!body?.threadId || !body?.itemText) {
    throw createError({ statusCode: 400, message: 'threadId and itemText required' })
  }

  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const taskId = crypto.randomUUID()

  // Create the task
  db.insert(emailTasks).values({
    id: taskId,
    threadId: body.threadId,
    text: body.itemText,
    due: body.due ?? null,
    done: 0,
    createdAt: now
  }).run()

  // Mark action item as added to tasks
  db.insert(actionItemStates).values({
    threadId: body.threadId,
    itemText: body.itemText,
    dismissed: 0,
    taskId,
    createdAt: now
  }).onConflictDoUpdate({
    target: [actionItemStates.threadId, actionItemStates.itemText],
    set: { taskId }
  }).run()

  return { taskId }
})
