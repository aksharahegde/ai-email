<script setup lang="ts">
import type { MailThread } from '~/types/mail'

definePageMeta({
  layout: 'dashboard'
})

const selectedThreadId = inject<Ref<string | null>>('mail:selectedThread')!
const { threads, status: threadsStatus } = useGmailThreads({ maxResults: 50, labelIds: ['SENT'] })

const displayThreads = computed<MailThread[]>(() => threads.value)
const selectedThread = computed(() =>
  selectedThreadId.value ? displayThreads.value.find(t => t.id === selectedThreadId.value) : null
)

function onSelectThread(id: string) {
  selectedThreadId.value = selectedThreadId.value === id ? null : id
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div
      v-if="!selectedThread"
      class="flex-1 overflow-hidden"
    >
      <MailList
        :threads="displayThreads"
        :selected-id="selectedThreadId"
        :loading="threadsStatus === 'pending'"
        @select="onSelectThread"
      />
    </div>
    <div
      v-else
      class="flex-1 overflow-auto"
    >
      <div class="p-2 border-b border-default">
        <UButton
          variant="ghost"
          size="sm"
          icon="i-lucide-arrow-left"
          @click="selectedThreadId = null"
        >
          Back
        </UButton>
      </div>
      <MailThread
        :thread-id="selectedThread.id"
        :subject="selectedThread.subject"
        :participants="selectedThread.participants"
        :timestamp="selectedThread.timestamp"
      />
    </div>
  </div>
</template>
