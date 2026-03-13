import type { ThreadAnalysis } from '../../../../app/types/mail'
import { getGmailClient, parseEmailAddress, getHeader, extractBody } from '../../utils/gmail'
import { getAiModel } from '../../utils/ai'
import { generateObject } from 'ai'
import { z } from 'zod'

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

export default defineEventHandler(async (event): Promise<ThreadAnalysis> => {
  const threadId = getQuery(event).threadId as string
  if (!threadId) {
    throw createError({ statusCode: 400, message: 'threadId required' })
  }

  const gmail = await getGmailClient(event)
  const thread = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full'
  })

  const messages = (thread.data.messages ?? []).map((msg) => {
    const headers = msg.payload?.headers ?? []
    const from = parseEmailAddress(getHeader(headers, 'From'))
    const body = extractBody(msg.payload!)
    return { from: `${from.name} <${from.email}>`, body: body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000) }
  })

  if (messages.length === 0) {
    return { summary: [], actionItems: [], questions: [], decisions: [], people: [] }
  }

  const threadText = messages.map(m => `From: ${m.from}\n${m.body}`).join('\n\n---\n\n')
  const model = await getAiModel('summarization', event)

  const { object } = await generateObject({
    model,
    schema: analysisSchema,
    prompt: `Analyze this email thread and extract:
1. summary: 3-5 bullet points summarizing the thread
2. actionItems: tasks or to-dos with optional due dates
3. questions: questions asked in the thread
4. decisions: decisions made or agreed upon
5. people: participants with name, email, and optional company/lastInteraction

Thread:\n${threadText.slice(0, 12000)}`
  })

  return object as ThreadAnalysis
})
