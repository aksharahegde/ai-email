import { eq } from 'drizzle-orm'
import { getDb } from '../../db'
import { emailTasks, threads } from '../../db/schema'
import { getSyncState } from '../../utils/sync'
import { runTaskExtraction } from '../../utils/tasks'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const db = getDb()

  const results = db.select({
    id: emailTasks.id,
    text: emailTasks.text,
    due: emailTasks.due,
    done: emailTasks.done,
    createdAt: emailTasks.createdAt,
    threadId: emailTasks.threadId,
    subject: threads.subject,
    participants: threads.participants
  })
    .from(emailTasks)
    .innerJoin(threads, eq(emailTasks.threadId, threads.id))
    .orderBy(emailTasks.createdAt)
    .all()

  const tasks = results.map(r => ({
    id: r.id,
    text: r.text,
    due: r.due,
    done: r.done === 1,
    threadId: r.threadId,
    subject: r.subject,
    from: (() => {
      try {
        const p = JSON.parse(r.participants) as { name: string, email: string }[]
        return p[0] ?? { name: '', email: '' }
      } catch {
        return { name: '', email: '' }
      }
    })()
  }))

  const extracting = (await getSyncState('tasks_extracting')) === '1'
  const lastExtractedAt = await getSyncState('tasks_last_extracted_at')

  // Auto-trigger extraction on first visit
  if (!lastExtractedAt && !extracting) {
    setImmediate(async () => {
      try { await runTaskExtraction(event) }
      catch (err) { console.error('[tasks] extraction failed:', err) }
    })
  }

  return { tasks, extracting: extracting || (!lastExtractedAt) }
})
