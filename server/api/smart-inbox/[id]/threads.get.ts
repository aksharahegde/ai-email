import { eq } from 'drizzle-orm'
import { getDb } from '../../../db'
import { smartInboxItems, smartInboxResults, threads } from '../../../db/schema'
import { shouldReclassify, runClassification } from '../../../utils/classify'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const db = getDb()

  const item = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()
  if (!item) throw createError({ statusCode: 404, message: 'Smart inbox not found' })

  // Return cached results immediately (stale-while-revalidate)
  const results = db.select({
    threadId: smartInboxResults.threadId,
    summary: smartInboxResults.summary,
    classifiedAt: smartInboxResults.classifiedAt,
    subject: threads.subject,
    snippet: threads.snippet,
    participants: threads.participants,
    unread: threads.unread,
    lastMessageAt: threads.lastMessageAt
  })
    .from(smartInboxResults)
    .innerJoin(threads, eq(smartInboxResults.threadId, threads.id))
    .where(eq(smartInboxResults.itemId, id))
    .orderBy(threads.lastMessageAt)
    .all()

  // Trigger background re-classification if stale
  const stale = shouldReclassify(item)
  if (stale) {
    setImmediate(async () => {
      try {
        await runClassification(id, event)
      } catch (err) {
        console.error('[classify] failed for', id, err)
      }
    })
  }

  // Re-read item to get current classifying state
  const currentItem = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()

  return {
    threads: results.map(r => ({
      id: r.threadId,
      subject: r.subject,
      snippet: r.snippet,
      participants: JSON.parse(r.participants),
      unread: r.unread === 1,
      lastMessageAt: r.lastMessageAt,
      timestamp: new Date(r.lastMessageAt * 1000),
      summary: r.summary,
      classifiedAt: r.classifiedAt
    })),
    syncing: (currentItem?.classifying ?? 0) === 1,
    classifyTotal: currentItem?.classifyTotal ?? 0,
    classifyDone: currentItem?.classifyDone ?? 0,
    lastClassifiedAt: item.lastClassifiedAt
  }
})
