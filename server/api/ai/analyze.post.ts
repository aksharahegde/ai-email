import { generateText } from 'ai'
import type { AiTag } from '../../../../app/types/mail'
import { getAiModel } from '../../utils/ai'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ subject: string, preview: string }>(event)
  if (!body?.subject && !body?.preview) {
    throw createError({ statusCode: 400, message: 'subject or preview required' })
  }

  const model = await getAiModel('analysis', event)
  const text = [body.subject, body.preview].filter(Boolean).join('\n')

  const { text: result } = await generateText({
    model,
    system: `Classify this email into one or more of these tags. Return ONLY a JSON array of tag names, nothing else.
Tags: action-required, question, decision, meeting, fyi
Examples: ["action-required", "question"] or ["fyi"]`,
    prompt: `Classify: ${text.slice(0, 500)}`
  })

  try {
    const tags = JSON.parse(result.trim().replace(/```json?\s*|\s*```/g, '')) as AiTag[]
    const valid: AiTag[] = ['action-required', 'question', 'decision', 'meeting', 'fyi']
    return { tags: tags.filter((t): t is AiTag => valid.includes(t)) }
  } catch {
    return { tags: ['fyi'] as AiTag[] }
  }
})
