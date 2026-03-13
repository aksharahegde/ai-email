import type { ThreadAnalysis, AiTag } from '~/types/mail'

export function useAiAnalyze() {
  return useFetch<{ tags: AiTag[] }>('/api/ai/analyze', {
    method: 'POST',
    body: {} as { subject: string; preview: string }
  })
}

export function useAiSummarize(messages: Ref<Array<{ from: string; body: string }>>) {
  return useFetch<{ summary: string[] }>('/api/ai/summarize', {
    method: 'POST',
    body: computed(() => ({ messages: messages.value })),
    watch: [messages]
  })
}

export function useAiDraft(context: Ref<string>, question?: Ref<string>) {
  return useFetch<{ draft: string }>('/api/ai/draft', {
    method: 'POST',
    body: computed(() => ({ context: context.value, question: question?.value })),
    watch: [context, question],
    immediate: false
  })
}

export function useAiImprove(text: Ref<string>, mode: Ref<'shorter' | 'professional' | 'clearer'>) {
  return useFetch<{ improved: string }>('/api/ai/improve', {
    method: 'POST',
    body: computed(() => ({ text: text.value, mode: mode.value })),
    watch: [text, mode],
    immediate: false
  })
}

export async function fetchAiSummary(messages: Array<{ from: string; body: string }>): Promise<string[]> {
  const { summary } = await $fetch<{ summary: string[] }>('/api/ai/summarize', {
    method: 'POST',
    body: { messages }
  })
  return summary ?? []
}

export async function fetchAiDraft(context: string, question?: string): Promise<string> {
  const { draft } = await $fetch<{ draft: string }>('/api/ai/draft', {
    method: 'POST',
    body: { context, question }
  })
  return draft ?? ''
}

export async function fetchAiImprove(text: string, mode: 'shorter' | 'professional' | 'clearer'): Promise<string> {
  const { improved } = await $fetch<{ improved: string }>('/api/ai/improve', {
    method: 'POST',
    body: { text, mode }
  })
  return improved ?? text
}
