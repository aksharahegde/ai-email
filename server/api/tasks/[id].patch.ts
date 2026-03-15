import { eq } from 'drizzle-orm'
import { getDb } from '../../db'
import { emailTasks } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const body = await readBody<{ done: boolean }>(event)

  const db = getDb()
  db.update(emailTasks)
    .set({ done: body.done ? 1 : 0 })
    .where(eq(emailTasks.id, id))
    .run()

  return { ok: true }
})
