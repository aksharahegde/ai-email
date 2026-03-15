<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

type Provider = 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq'

const provider = ref<Provider>('ollama')
const apiKey = ref('')
const ollamaUrl = ref('http://localhost:11434')
const ollamaConnected = ref(false)
const ollamaModels = ref<Array<{ name: string, size: number }>>([])
const ollamaLoading = ref(false)
const selectedModel = ref('')
const saveLoading = ref(false)
const saveSuccess = ref(false)

async function loadSettings() {
  try {
    const s = await $fetch<{ provider?: string, model?: string, ollamaUrl?: string, apiKey?: string }>('/api/settings/ai')
    if (s.provider) provider.value = s.provider as Provider
    if (s.model) selectedModel.value = s.model
    if (s.ollamaUrl) ollamaUrl.value = s.ollamaUrl
    if (s.apiKey) apiKey.value = s.apiKey
  } catch {}
}

async function checkOllamaStatus() {
  ollamaLoading.value = true
  ollamaConnected.value = false
  try {
    const res = await $fetch<{ connected: boolean, models: Array<{ name: string, size: number }> }>('/api/ollama/status', {
      query: { url: ollamaUrl.value }
    })
    ollamaConnected.value = res.connected
    ollamaModels.value = res.models ?? []
    if (!selectedModel.value && ollamaModels.value.length) {
      selectedModel.value = ollamaModels.value[0]?.name ?? ''
    }
  } catch {
    ollamaConnected.value = false
    ollamaModels.value = []
  } finally {
    ollamaLoading.value = false
  }
}

async function fetchOllamaModels() {
  ollamaLoading.value = true
  try {
    const res = await $fetch<{ models: Array<{ name: string, size: number }> }>('/api/ollama/models', {
      query: { url: ollamaUrl.value }
    })
    ollamaModels.value = res.models
    if (!selectedModel.value && res.models.length) {
      selectedModel.value = res.models[0]?.name ?? ''
    }
  } catch {
    ollamaModels.value = []
  } finally {
    ollamaLoading.value = false
  }
}

async function saveSettings() {
  saveLoading.value = true
  saveSuccess.value = false
  try {
    await $fetch('/api/settings/ai', {
      method: 'POST',
      body: {
        provider: provider.value,
        model: selectedModel.value || undefined,
        ollamaUrl: ollamaUrl.value,
        apiKey: apiKey.value || undefined
      }
    })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2000)
  } finally {
    saveLoading.value = false
  }
}

onMounted(async () => {
  await loadSettings()
  if (provider.value === 'ollama') {
    checkOllamaStatus()
  }
})

watch(provider, (p) => {
  if (p === 'ollama') {
    checkOllamaStatus()
  }
})
</script>

<template>
  <div class="p-4 max-w-2xl">
    <h1 class="text-xl font-semibold mb-6">
      AI Configuration
    </h1>

    <div class="space-y-6">
      <UCard>
        <template #header>
          <h2 class="font-medium">
            Provider
          </h2>
        </template>
        <div class="flex flex-wrap gap-2">
          <UButton
            :variant="provider === 'ollama' ? 'soft' : 'ghost'"
            size="sm"
            @click="provider = 'ollama'"
          >
            Ollama
          </UButton>
          <UButton
            :variant="provider === 'openai' ? 'soft' : 'ghost'"
            size="sm"
            @click="provider = 'openai'"
          >
            OpenAI
          </UButton>
          <UButton
            :variant="provider === 'anthropic' ? 'soft' : 'ghost'"
            size="sm"
            @click="provider = 'anthropic'"
          >
            Anthropic
          </UButton>
          <UButton
            :variant="provider === 'google' ? 'soft' : 'ghost'"
            size="sm"
            @click="provider = 'google'"
          >
            Google AI
          </UButton>
          <UButton
            :variant="provider === 'groq' ? 'soft' : 'ghost'"
            size="sm"
            @click="provider = 'groq'"
          >
            Groq
          </UButton>
        </div>
      </UCard>

      <UCard v-if="provider === 'ollama'">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-medium">
              Ollama
            </h2>
            <span
              class="flex items-center gap-1.5 text-sm"
              :class="ollamaConnected ? 'text-green-600' : 'text-muted'"
            >
              <span
                class="w-2 h-2 rounded-full"
                :class="ollamaConnected ? 'bg-green-500' : 'bg-neutral-400'"
              />
              {{ ollamaConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
        </template>
        <div class="space-y-4">
          <UFormField label="URL">
            <UInput
              v-model="ollamaUrl"
              placeholder="http://localhost:11434"
              data-testid="ai-settings-ollama-url"
            />
          </UFormField>

          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium">Available Models</span>
              <UButton
                size="xs"
                variant="ghost"
                :loading="ollamaLoading"
                data-testid="ai-settings-refresh-models"
                @click="fetchOllamaModels"
              >
                Refresh
              </UButton>
            </div>
            <div
              v-if="ollamaLoading && !ollamaModels.length"
              class="py-8 text-center text-muted text-sm"
            >
              Loading models...
            </div>
            <USelectMenu
              v-else
              v-model="selectedModel"
              :items="ollamaModels.map(m => ({ label: `${m.name} (${(m.size / 1e9).toFixed(1)} GB)`, value: m.name }))"
              value-key="value"
              placeholder="Select model"
              class="w-full"
              data-testid="ai-settings-model-select"
            />
          </div>
        </div>
      </UCard>

      <UCard v-if="provider !== 'ollama'">
        <template #header>
          <h2 class="font-medium">
            {{ provider }}
          </h2>
        </template>
        <UFormField label="API Key">
          <UInput
            v-model="apiKey"
            type="password"
            placeholder="Enter API key"
            data-testid="ai-settings-api-key"
          />
        </UFormField>
      </UCard>

      <UButton
        variant="solid"
        :loading="saveLoading"
        :icon="saveSuccess ? 'i-lucide-check' : undefined"
        :color="saveSuccess ? 'success' : 'primary'"
        data-testid="ai-settings-save"
        @click="saveSettings"
      >
        {{ saveSuccess ? 'Saved' : 'Save Settings' }}
      </UButton>
    </div>
  </div>
</template>
