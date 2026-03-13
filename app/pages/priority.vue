<script setup lang="ts">
import type { MailThread } from '~/types/mail'

definePageMeta({
  layout: 'dashboard'
})

const viewMode = ref<'all' | 'priority'>('all')
const selectedThreadId = inject<Ref<string | null>>('mail:selectedThread')!
const { threads } = useGmailThreads({ maxResults: 50, labelIds: ['INBOX'] })

const displayThreads = computed<MailThread[]>(() => threads.value)

const priorityThreads = computed(() =>
  displayThreads.value.filter(t =>
    t.tags.some(tag =>
      ['action-required', 'question', 'decision'].includes(tag)
    )
  )
)

const displayedThreads = computed(() =>
  viewMode.value === 'priority' ? priorityThreads.value : displayThreads.value
)

const selectedThread = computed(() =>
  selectedThreadId.value
    ? displayedThreads.value.find(t => t.id === selectedThreadId.value)
    : null
)

function onSelectThread(id: string) {
  selectedThreadId.value = selectedThreadId.value === id ? null : id
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="p-4 border-b border-default">
      <div class="flex gap-2">
        <UButton
          :variant="viewMode === 'all' ? 'soft' : 'ghost'"
          size="sm"
          @click="viewMode = 'all'"
        >
          All Mail
        </UButton>
        <UButton
          :variant="viewMode === 'priority' ? 'soft' : 'ghost'"
          size="sm"
          @click="viewMode = 'priority'"
        >
          AI Priority
        </UButton>
      </div>
    </div>
    <div
      v-if="!selectedThread"
      class="flex-1 overflow-hidden"
    >
      <MailList
        :threads="displayedThreads"
        :selected-id="selectedThreadId"
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
