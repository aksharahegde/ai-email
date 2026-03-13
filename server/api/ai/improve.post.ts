import { getAiModel } from '../../utils/ai'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    text: string
    mode: 'shorter' | 'professional' | 'clearer'
  }>(event)
  if (!body?.text) {
    throw createError({ statusCode: 400, message: 'text required' })
  }

  const model = await getAiModel('writing', event)
  const mode = body.mode || 'professional'
  const instructions: Record<string, string> = {
    shorter: 'Make this text more concise. Remove unnecessary words. Return ONLY the improved text.',
    professional: 'Rewrite this in a professional, business-appropriate tone. Return ONLY the improved text.',
    clearer: 'Rewrite this to be clearer and easier to understand. Return ONLY the improved text.'
  }

  const { text } = await generateText({
    model,
    system: instructions[mode] || instructions.professional,
    prompt: body.text.slice(0, 4000)
  })

  return { improved: text.trim() }
})
