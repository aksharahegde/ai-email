import { eq } from 'drizzle-orm'
import { generateText } from 'ai'
import { getAiModel } from '../../utils/ai'
import { getDb } from '../../db'
import { threads, messages } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const body = await readBody<{
    threadId: string
    question: string
    history?: Array<{ role: 'user' | 'assistant', content: string }>
  }>(event)

  if (!body?.threadId || !body?.question?.trim()) {
    throw createError({ statusCode: 400, message: 'threadId and question required' })
  }

  const db = getDb()

  const thread = db.select({ subject: threads.subject })
    .from(threads).where(eq(threads.id, body.threadId)).get()

  if (!thread) throw createError({ statusCode: 404, message: 'Thread not found' })

  const msgs = db.select().from(messages)
    .where(eq(messages.threadId, body.threadId))
    .orderBy(messages.timestamp)
    .all()

  function bodyToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, ' ').trim()
  }

  const threadContext = msgs.map((m) => {
    const from = (() => { try { return JSON.parse(m.from) as { name: string, email: string } } catch { return { name: '', email: '' } } })()
    return `From: ${from.name} <${from.email}>\n${bodyToText(m.body).slice(0, 1500)}`
  }).join('\n\n---\n\n')

  const historyText = (body.history ?? []).map(h =>
    `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`
  ).join('\n')

  const model = await getAiModel('analysis', event)

  const { text } = await generateText({
    model,
    system: `You are a helpful email assistant. Answer questions about the following email thread concisely and accurately. Only use information present in the thread.

Email thread (Subject: ${thread.subject}):
${threadContext.slice(0, 8000)}`,
    prompt: historyText
      ? `Previous conversation:\n${historyText}\n\nUser: ${body.question}`
      : body.question
  })

  return { answer: text.trim() }
})
