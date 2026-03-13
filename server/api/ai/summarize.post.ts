import { getAiModel } from '../../utils/ai'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ messages: Array<{ from: string, body: string }> }>(event)
  if (!body?.messages?.length) {
    throw createError({ statusCode: 400, message: 'messages required' })
  }

  const model = await getAiModel('summarization', event)
  const threadText = body.messages.map(m => `From: ${m.from}\n${m.body}`).join('\n\n---\n\n')

  const { text } = await generateText({
    model,
    system: `Summarize this email thread into 3-5 bullet points. Return ONLY the bullet points, one per line, starting with "•". Be concise.`,
    prompt: threadText.slice(0, 8000)
  })

  const summary = text.split('\n').filter(l => l.trim().startsWith('•')).map(l => l.replace(/^[•\-]\s*/, '').trim()).filter(Boolean)
  return { summary: summary.length ? summary : [text.trim().slice(0, 200)] }
})
