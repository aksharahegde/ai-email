import type { H3Event } from 'h3'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { groq } from '@ai-sdk/groq'
import { getSyncState } from './sync'

type Provider = 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq'

function getProvider(provider: Provider, modelId: string, config: Record<string, string>) {
  switch (provider) {
    case 'ollama': {
      const ollamaProvider = createOpenAI({
        baseURL: `${config.ollamaUrl || 'http://localhost:11434'}/v1`,
        apiKey: 'ollama',
      })
      return ollamaProvider(modelId)
    }
    case 'openai':
      return openai(modelId)
    case 'anthropic':
      return anthropic(modelId)
    case 'google':
      return google(modelId)
    case 'groq':
      return groq(modelId)
    default: {
      const defaultProvider = createOpenAI({
        baseURL: `${config.ollamaUrl || 'http://localhost:11434'}/v1`,
        apiKey: 'ollama',
      })
      return defaultProvider(modelId)
    }
  }
}

export async function getAiModel(task: 'analysis' | 'summarization' | 'drafting' | 'writing', event?: H3Event) {
  const config = useRuntimeConfig(event)
  let provider = (config.ai?.provider as Provider) || 'ollama'
  let modelId = (config.ai?.model as string) || (config.ai?.models as Record<string, string>)?.[task] || 'llama3.2'
  let ollamaUrl = (config.ai?.ollamaUrl as string) || process.env.OLLAMA_BASE_URL || 'http://localhost:11434'

  const raw = await getSyncState('ai_settings')
  if (raw) {
    try {
      const aiSettings = JSON.parse(raw) as Record<string, string>
      provider = (aiSettings.provider as Provider) || provider
      modelId = aiSettings.model || modelId
      ollamaUrl = aiSettings.ollamaUrl || ollamaUrl
    } catch {}
  }

  return getProvider(provider, modelId, { ollamaUrl })
}
