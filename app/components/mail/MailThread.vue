<script setup lang="ts">
import type { MailMessage as MailMessageType } from '~/types/mail'

const props = defineProps<{
  threadId: string
  subject: string
  participants: Array<{ email: string, name: string }>
  timestamp: Date
}>()

const { thread: gmailThread, status: threadStatus } = useGmailThread(toRef(props, 'threadId'))

const messages = computed<MailMessageType[]>(() => gmailThread.value?.messages ?? [])

const aiSummary = ref<string[]>([])
watch(
  () => gmailThread.value?.messages,
  async (msgs) => {
    if (!msgs?.length) {
      aiSummary.value = []
      return
    }
    try {
      const { summary } = await $fetch<{ summary: string[] }>('/api/ai/summarize', {
        method: 'POST',
        body: { messages: msgs.map(m => ({ from: `${m.from.name} <${m.from.email}>`, body: m.body })) }
      })
      aiSummary.value = summary ?? []
    } catch {
      aiSummary.value = []
    }
  },
  { immediate: true }
)

function formatDateTime(date: Date) {
  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}
</script>

<template>
  <div class="p-4">
    <div class="mb-4">
      <h2 class="text-lg font-semibold">
        {{ subject }}
      </h2>
      <div class="flex items-center gap-2 mt-1 text-sm text-muted">
        <UAvatarGroup :max="3">
          <UAvatar
            v-for="p in participants"
            :key="p.email"
            :alt="p.name"
            size="xs"
          >
            {{ p.name.charAt(0) }}
          </UAvatar>
        </UAvatarGroup>
        <span>{{ formatDateTime(timestamp) }}</span>
      </div>
    </div>

    <AiSummaryCard
      v-if="aiSummary.length"
      :summary="aiSummary"
    />

    <div
      v-if="threadStatus === 'pending'"
      class="py-8 text-center text-muted text-sm"
    >
      Loading messages...
    </div>
    <div
      v-else
      class="space-y-0"
    >
      <MailMessage
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />
    </div>
  </div>
</template>
