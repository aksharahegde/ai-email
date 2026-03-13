<script setup lang="ts">
const props = defineProps<{
  open?: boolean
  threadContext?: string
  replyThreadId?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const open = computed({
  get: () => props.open ?? false,
  set: v => emit('update:open', v)
})

const to = ref('')
const subject = ref('')
const body = ref('')
const aiSuggestion = ref('')
const aiLoading = ref(false)

function insertSuggestion() {
  if (aiSuggestion.value) {
    body.value = aiSuggestion.value
    aiSuggestion.value = ''
  }
}

async function fetchAiDraft() {
  aiLoading.value = true
  aiSuggestion.value = ''
  try {
    const context = props.threadContext || `Subject: ${subject.value}\n\n${body.value}`.trim() || 'Compose a brief professional email.'
    const { draft } = await $fetch<{ draft: string }>('/api/ai/draft', {
      method: 'POST',
      body: { context }
    })
    aiSuggestion.value = draft ?? ''
  } catch {
    aiSuggestion.value = ''
  } finally {
    aiLoading.value = false
  }
}

async function fetchAiImprove(mode: 'shorter' | 'professional' | 'clearer') {
  if (!body.value.trim()) return
  aiLoading.value = true
  try {
    const { improved } = await $fetch<{ improved: string }>('/api/ai/improve', {
      method: 'POST',
      body: { text: body.value, mode }
    })
    body.value = improved ?? body.value
  } finally {
    aiLoading.value = false
  }
}

const sendLoading = ref(false)
async function send() {
  if (!to.value.trim() || !subject.value.trim() || !body.value.trim()) return
  sendLoading.value = true
  try {
    await $fetch('/api/gmail/messages', {
      method: 'POST',
      body: {
        to: to.value.trim(),
        subject: subject.value.trim(),
        body: body.value.trim(),
        threadId: props.replyThreadId
      }
    })
    to.value = ''
    subject.value = ''
    body.value = ''
    aiSuggestion.value = ''
    open.value = false
  } finally {
    sendLoading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Compose"
    class="max-w-2xl"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="To">
          <UInput
            v-model="to"
            placeholder="Recipient email"
            data-testid="compose-to-input"
          />
        </UFormField>
        <UFormField label="Subject">
          <UInput
            v-model="subject"
            placeholder="Subject"
            data-testid="compose-subject-input"
          />
        </UFormField>
        <UFormField label="Message">
          <UTextarea
            v-model="body"
            placeholder="Write your message..."
            :rows="8"
            data-testid="compose-body-input"
          />
        </UFormField>

        <div class="flex flex-wrap gap-2">
          <UButton
            size="sm"
            variant="outline"
            icon="i-lucide-sparkles"
            :loading="aiLoading"
            data-testid="compose-ai-draft"
            @click="fetchAiDraft"
          >
            AI Draft
          </UButton>
          <UButton
            size="sm"
            variant="outline"
            icon="i-lucide-wand-2"
            data-testid="compose-improve-writing"
            :loading="aiLoading"
            @click="fetchAiImprove('clearer')"
          >
            Improve Writing
          </UButton>
          <UButton
            size="sm"
            variant="outline"
            icon="i-lucide-minimize-2"
            data-testid="compose-make-shorter"
            :loading="aiLoading"
            @click="fetchAiImprove('shorter')"
          >
            Make Shorter
          </UButton>
          <UButton
            size="sm"
            variant="outline"
            icon="i-lucide-briefcase"
            data-testid="compose-make-professional"
            :loading="aiLoading"
            @click="fetchAiImprove('professional')"
          >
            Make Professional
          </UButton>
        </div>

        <UCard
          v-if="aiSuggestion"
          class="bg-neutral-100"
        >
          <template #header>
            <span class="text-sm font-medium">Suggested Reply</span>
          </template>
          <p class="text-sm mb-4">
            {{ aiSuggestion }}
          </p>
          <div class="flex gap-2">
            <UButton
              size="sm"
              data-testid="compose-insert-suggestion"
              @click="insertSuggestion"
            >
              Insert
            </UButton>
            <UButton
              size="sm"
              variant="outline"
              data-testid="compose-edit-suggestion"
            >
              Edit
            </UButton>
          </div>
        </UCard>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          @click="open = false"
        >
          Cancel
        </UButton>
        <UButton
          data-testid="compose-send"
          :loading="sendLoading"
          @click="send"
        >
          Send
        </UButton>
      </div>
    </template>
  </UModal>
</template>
