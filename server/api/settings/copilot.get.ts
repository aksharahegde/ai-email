import { getSyncState } from '../../utils/sync'

export const DEFAULT_ANALYSIS_PROMPT = `Analyze this email thread and extract:
1. summary: 3-5 bullet points summarizing the thread
2. actionItems: tasks or to-dos with optional due dates
3. questions: questions asked in the thread
4. decisions: decisions made or agreed upon
5. people: participants with name, email, and optional company/lastInteraction`

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const prompt = await getSyncState('copilot_analysis_prompt')
  return { prompt: prompt ?? DEFAULT_ANALYSIS_PROMPT }
})
