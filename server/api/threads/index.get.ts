import { eq, desc } from 'drizzle-orm'
import { getDb } from '../../db'
import { threads } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 200)
  const offset = Number(query.offset) || 0
  const labelFilter = query.label as string | undefined
  const unreadFilter = query.unread === '1' ? 1 : undefined

  const db = getDb()

  let rows

  if (labelFilter) {
    // Fetch all threads and filter in JS to avoid snake_case/camelCase mismatch
    // from raw SQL returning SQLite column names instead of Drizzle field names.
    // Max dataset is bounded (INITIAL_SYNC_LIMIT = 200) so this is acceptable.
    rows = db.select().from(threads)
      .orderBy(desc(threads.lastMessageAt))
      .all()
      .filter(t => {
        const labels: string[] = JSON.parse(t.labels)
        const matchesLabel = labels.includes(labelFilter)
        const matchesUnread = unreadFilter === undefined || t.unread === unreadFilter
        return matchesLabel && matchesUnread
      })
      .slice(offset, offset + limit)
  } else {
    rows = db.select().from(threads)
      .where(unreadFilter !== undefined ? eq(threads.unread, unreadFilter) : undefined)
      .orderBy(desc(threads.lastMessageAt))
      .limit(limit)
      .offset(offset)
      .all()
  }

  const result = rows.map(t => ({
    id: t.id,
    subject: t.subject,
    snippet: t.snippet,
    participants: JSON.parse(t.participants),
    unread: t.unread === 1,
    messageCount: t.messageCount,
    lastMessageAt: t.lastMessageAt,
    labels: JSON.parse(t.labels),
    syncedAt: t.syncedAt
  }))

  return { threads: result }
})
