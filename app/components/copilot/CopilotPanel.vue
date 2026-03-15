<script setup lang="ts">
import type { ThreadAnalysis } from '~/types/mail'

const props = defineProps<{
  threadId?: string | null
}>()

// --- Analysis ---
const triggered = ref(false)
const analysis = ref<ThreadAnalysis | null>(null)
const analysisStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')

// --- Chat ---
type Message = { role: 'user' | 'assistant', content: string }
const chatHistory = ref<Message[]>([])
const question = ref('')
const chatLoading = ref(false)
const chatContainer = ref<HTMLElement | null>(null)

// Reset when thread changes
watch(() => props.threadId, () => {
  triggered.value = false
  analysis.value = null
  analysisStatus.value = 'idle'
  chatHistory.value = []
  question.value = ''
})

async function analyze() {
  if (!props.threadId) return
  triggered.value = true
  analysisStatus.value = 'pending'
  try {
    analysis.value = await $fetch<ThreadAnalysis>(`/api/ai/thread-analysis?threadId=${props.threadId}`)
    analysisStatus.value = 'success'
  } catch {
    analysisStatus.value = 'error'
  }
}

async function sendQuestion() {
  const q = question.value.trim()
  if (!q || !props.threadId || chatLoading.value) return

  chatHistory.value.push({ role: 'user', content: q })
  question.value = ''
  chatLoading.value = true

  await nextTick()
  scrollChat()

  try {
    const { answer } = await $fetch<{ answer: string }>('/api/ai/thread-chat', {
      method: 'POST',
      body: {
        threadId: props.threadId,
        question: q,
        history: chatHistory.value.slice(0, -1) // exclude the just-added user message
      }
    })
    chatHistory.value.push({ role: 'assistant', content: answer })
  } catch {
    chatHistory.value.push({ role: 'assistant', content: 'Sorry, something went wrong. Please try again.' })
  } finally {
    chatLoading.value = false
    await nextTick()
    scrollChat()
  }
}

function scrollChat() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendQuestion()
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- No thread selected -->
    <div
      v-if="!threadId"
      class="flex-1 flex flex-col items-center justify-center text-center text-muted text-sm p-4"
    >
      <UIcon name="i-lucide-mail-open" class="w-12 h-12 mb-4 opacity-50" />
      <p>Select an email thread to see AI insights</p>
    </div>

    <template v-else>
      <!-- Analysis area -->
      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        <!-- Not yet triggered -->
        <div
          v-if="!triggered"
          class="text-center py-8 text-muted text-sm"
        >
          <UIcon name="i-lucide-sparkles" class="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p class="mb-3">Analyze this thread with AI</p>
          <UButton icon="i-lucide-sparkles" size="sm" @click="analyze">
            Analyze
          </UButton>
        </div>

        <!-- Loading -->
        <div
          v-else-if="analysisStatus === 'pending'"
          class="text-center py-8 text-muted text-sm"
        >
          <UIcon name="i-lucide-loader-2" class="w-10 h-10 mx-auto mb-3 opacity-50 animate-spin" />
          <p>Analyzing thread...</p>
        </div>

        <!-- Error -->
        <div
          v-else-if="analysisStatus === 'error'"
          class="text-center py-8 text-muted text-sm"
        >
          <UIcon name="i-lucide-alert-circle" class="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p class="mb-3">Analysis failed</p>
          <UButton size="sm" variant="outline" color="neutral" @click="analyze">
            Retry
          </UButton>
        </div>

        <!-- Results -->
        <template v-else-if="analysis">
          <CopilotSummary :summary="analysis.summary" />
          <CopilotActions :items="analysis.actionItems" :thread-id="threadId!" />
          <CopilotQuestions :questions="analysis.questions" :thread-id="threadId!" />
          <CopilotDecisions :decisions="analysis.decisions" />
          <CopilotPeople :people="analysis.people" />
        </template>

        <!-- Chat history -->
        <div v-if="chatHistory.length">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            Chat
          </h4>
          <div ref="chatContainer" class="space-y-3">
            <div
              v-for="(msg, i) in chatHistory"
              :key="i"
              class="flex gap-2"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[85%] rounded-xl px-3 py-2 text-sm"
                :class="msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 rounded-bl-sm'"
              >
                {{ msg.content }}
              </div>
            </div>
            <div v-if="chatLoading" class="flex justify-start">
              <div class="bg-neutral-100 dark:bg-neutral-800 rounded-xl rounded-bl-sm px-3 py-2">
                <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin text-muted" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat input — always visible when thread is open -->
      <div class="border-t border-default p-3 shrink-0">
        <div class="flex gap-2 items-end">
          <UTextarea
            v-model="question"
            placeholder="Ask about this email…"
            :rows="1"
            autoresize
            class="flex-1 text-sm"
            :disabled="chatLoading"
            @keydown="onKeydown"
          />
          <UButton
            icon="i-lucide-send"
            size="sm"
            :loading="chatLoading"
            :disabled="!question.trim()"
            aria-label="Send"
            @click="sendQuestion"
          />
        </div>
        <p class="text-xs text-muted mt-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </template>
  </div>
</template>
