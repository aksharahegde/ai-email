import { generateText } from 'ai'
import { eq, and } from 'drizzle-orm'
import { getAiModel } from '../../utils/ai'
import { getDb } from '../../db'
import { threads, threadAiCache } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    messages: Array<{ from: string, body: string }>
    threadId?: string
  }>(event)

  if (!body?.messages?.length) {
    throw createError({ statusCode: 400, message: 'messages required' })
  }

  const db = getDb()

  // Check cache if threadId provided
  if (body.threadId) {
    const thread = db.select({ lastMessageAt: threads.lastMessageAt })
      .from(threads).where(eq(threads.id, body.threadId)).get()

    if (thread) {
      const cached = db.select({ data: threadAiCache.data })
        .from(threadAiCache)
        .where(and(
          eq(threadAiCache.threadId, body.threadId),
          eq(threadAiCache.type, 'summary'),
          eq(threadAiCache.lastMessageAt, thread.lastMessageAt)
        ))
        .get()

      if (cached) {
        return JSON.parse(cached.data)
      }
    }
  }

  const model = await getAiModel('summarization', event)
  const threadText = body.messages.map(m => {
    const plain = m.body
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, ' ')
      .trim()
    return `From: ${m.from}\n${plain}`
  }).join('\n\n---\n\n')

  const { text } = await generateText({
    model,
    system: `Summarize this email thread into 3-5 bullet points. Return ONLY the bullet points, one per line, starting with "•". Be concise.`,
    prompt: threadText.slice(0, 8000)
  })

  const summary = text.split('\n').filter(l => l.trim().startsWith('•')).map(l => l.replace(/^[•\-]\s*/, '').trim()).filter(Boolean)
  const result = { summary: summary.length ? summary : [text.trim().slice(0, 200)] }

  // Store in cache
  if (body.threadId) {
    const thread = db.select({ lastMessageAt: threads.lastMessageAt })
      .from(threads).where(eq(threads.id, body.threadId)).get()

    if (thread) {
      db.insert(threadAiCache).values({
        threadId: body.threadId,
        type: 'summary',
        lastMessageAt: thread.lastMessageAt,
        data: JSON.stringify(result),
        createdAt: Math.floor(Date.now() / 1000)
      }).onConflictDoUpdate({
        target: [threadAiCache.threadId, threadAiCache.type],
        set: { lastMessageAt: thread.lastMessageAt, data: JSON.stringify(result), createdAt: Math.floor(Date.now() / 1000) }
      }).run()
    }
  }

  return result
})
