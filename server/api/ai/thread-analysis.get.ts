import { eq, and } from 'drizzle-orm'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { ThreadAnalysis } from '../../../../app/types/mail'
import { getAiModel } from '../../utils/ai'
import { getSyncState } from '../../utils/sync'
import { getDb } from '../../db'
import { threads, messages, threadAiCache } from '../../db/schema'
import { DEFAULT_ANALYSIS_PROMPT } from '../settings/copilot.get'

const analysisSchema = z.object({
  summary: z.array(z.string()),
  actionItems: z.array(z.object({ text: z.string(), due: z.string().optional() })),
  questions: z.array(z.string()),
  decisions: z.array(z.string()),
  people: z.array(z.object({
    name: z.string(),
    email: z.string(),
    company: z.string().optional(),
    lastInteraction: z.string().optional()
  }))
})

const EMPTY: ThreadAnalysis = { summary: [], actionItems: [], questions: [], decisions: [], people: [] }

export default defineEventHandler(async (event): Promise<ThreadAnalysis> => {
  const threadId = getQuery(event).threadId as string
  if (!threadId) throw createError({ statusCode: 400, message: 'threadId required' })

  const db = getDb()

  const thread = db.select({ lastMessageAt: threads.lastMessageAt })
    .from(threads).where(eq(threads.id, threadId)).get()

  if (!thread) throw createError({ statusCode: 404, message: 'Thread not found' })

  // Return cached result if still valid (same lastMessageAt = no new replies)
  const cached = db.select({ data: threadAiCache.data })
    .from(threadAiCache)
    .where(and(
      eq(threadAiCache.threadId, threadId),
      eq(threadAiCache.type, 'analysis'),
      eq(threadAiCache.lastMessageAt, thread.lastMessageAt)
    ))
    .get()

  if (cached) {
    return JSON.parse(cached.data) as ThreadAnalysis
  }

  // Read messages from local DB
  const msgs = db.select().from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(messages.timestamp)
    .all()

  if (!msgs.length) return EMPTY

  function bodyToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, ' ').trim()
  }

  const threadText = msgs.map((m) => {
    const from = (() => { try { return JSON.parse(m.from) as { name: string, email: string } } catch { return { name: '', email: '' } } })()
    return `From: ${from.name} <${from.email}>\n${bodyToText(m.body).slice(0, 2000)}`
  }).join('\n\n---\n\n')

  const model = await getAiModel('summarization', event)
  const analysisPrompt = (await getSyncState('copilot_analysis_prompt')) ?? DEFAULT_ANALYSIS_PROMPT

  const { object } = await generateObject({
    model,
    schema: analysisSchema,
    prompt: `${analysisPrompt}\n\nThread:\n${threadText.slice(0, 12000)}`
  })

  const result = object as ThreadAnalysis

  // Store in cache
  db.insert(threadAiCache).values({
    threadId,
    type: 'analysis',
    lastMessageAt: thread.lastMessageAt,
    data: JSON.stringify(result),
    createdAt: Math.floor(Date.now() / 1000)
  }).onConflictDoUpdate({
    target: [threadAiCache.threadId, threadAiCache.type],
    set: { lastMessageAt: thread.lastMessageAt, data: JSON.stringify(result), createdAt: Math.floor(Date.now() / 1000) }
  }).run()

  return result
})
