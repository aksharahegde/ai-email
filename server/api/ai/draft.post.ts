import { getAiModel } from '../../utils/ai'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    context: string
    question?: string
    tone?: string
  }>(event)
  if (!body?.context) {
    throw createError({ statusCode: 400, message: 'context required' })
  }

  const model = await getAiModel('drafting', event)
  const question = body.question ? `\nSpecifically address: ${body.question}` : ''
  const tone = body.tone ? `\nTone: ${body.tone}` : ''

  const { text } = await generateText({
    model,
    system: `You are an email assistant. Draft a professional, concise reply. Return ONLY the email body, no subject or headers.${tone}`,
    prompt: `Email thread:\n${body.context.slice(0, 6000)}${question}\n\nDraft reply:`
  })

  return { draft: text.trim() }
})
