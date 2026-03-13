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

async function analyzeThread(gmail: Awaited<ReturnType<typeof getGmailClient>>, model: Awaited<ReturnType<typeof getAiModel>>, threadId: string): Promise<ThreadAnalysis['actionItems']> {
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

  if (messages.length === 0) return []

  const threadText = messages.map(m => `From: ${m.from}\n${m.body}`).join('\n\n---\n\n')
  const { object } = await generateObject({
    model,
    schema: analysisSchema,
    prompt: `Extract action items (tasks, to-dos) from this email thread. Return summary, actionItems, questions, decisions, people. Focus on actionItems. Thread:\n${threadText.slice(0, 8000)}`
  })

  return (object as ThreadAnalysis).actionItems
}

export default defineEventHandler(async (event) => {
  const gmail = await getGmailClient(event)
  const query = getQuery(event)
  const maxThreads = Math.min(Number(query.maxThreads) || 10, 15)

  const res = await gmail.users.threads.list({
    userId: 'me',
    maxResults: maxThreads,
    labelIds: ['INBOX'],
    q: 'is:unread OR newer_than:7d'
  })

  const threads = res.data.threads ?? []
  if (threads.length === 0) {
    return { tasks: [] }
  }

  const model = await getAiModel('summarization', event)
  const threadDetails = await Promise.all(
    threads.map(t => gmail.users.threads.get({
      userId: 'me',
      id: t.id!,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject']
    }))
  )

  const tasks: Array<{ id: string, text: string, due?: string, source: string, done: boolean }> = []
  let taskId = 0

  for (let i = 0; i < threads.length; i++) {
    const td = threadDetails[i]
    const subject = td.data.messages?.[0]?.payload?.headers?.find(h => h.name?.toLowerCase() === 'subject')?.value ?? '(No subject)'
    const from = td.data.messages?.[0]?.payload?.headers?.find(h => h.name?.toLowerCase() === 'from')?.value ?? ''
    const source = `${from.replace(/<[^>]+>/g, '').trim()} - ${subject}`

    try {
      const actionItems = await analyzeThread(gmail, model, threads[i].id!)
      for (const item of actionItems) {
        tasks.push({
          id: `t-${taskId++}`,
          text: item.text,
          due: item.due,
          source,
          done: false
        })
      }
    } catch {
      // Skip thread on analysis error
    }
  }

  return { tasks }
})
