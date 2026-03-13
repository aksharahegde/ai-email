import { eq, desc, sql } from 'drizzle-orm'
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
    // Join with json_each to filter by label (SQLite JSON array)
    const rawSql = sql`
      SELECT t.*
      FROM threads t, json_each(t.labels) je
      WHERE je.value = ${labelFilter}
      ${unreadFilter !== undefined ? sql`AND t.unread = ${unreadFilter}` : sql``}
      ORDER BY t.last_message_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    rows = db.all(rawSql) as typeof threads.$inferSelect[]
  } else {
    rows = await db.select().from(threads)
      .where(unreadFilter !== undefined ? eq(threads.unread, unreadFilter) : undefined)
      .orderBy(desc(threads.lastMessageAt))
      .limit(limit)
      .offset(offset)
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
