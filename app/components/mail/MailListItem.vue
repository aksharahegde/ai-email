<script setup lang="ts">
import type { MailThread } from '~/types/mail'

const props = defineProps<{
  thread: MailThread
  selected?: boolean
  summary?: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

function formatTime(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const primaryParticipant = computed(() => props.thread.participants[0] ?? { email: '', name: 'Unknown' })
const displaySnippet = computed(() => props.summary ?? props.thread.snippet)
</script>

<template>
  <button
    type="button"
    class="w-full text-left px-4 py-3 hover:bg-neutral-100 transition-colors border-b border-default"
    :class="{ 'bg-neutral-200': selected }"
    data-testid="mail-thread-row"
    @click="emit('select', thread.id)"
  >
    <div class="flex gap-3">
      <UAvatar
        :alt="primaryParticipant.name"
        :src="primaryParticipant.avatar"
        size="sm"
      />
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <span
            class="truncate font-medium"
            :class="{ 'font-semibold': thread.unread }"
          >
            {{ primaryParticipant.name }}
          </span>
          <span class="text-xs text-muted shrink-0">
            {{ formatTime(thread.timestamp) }}
          </span>
        </div>
        <p
          class="truncate text-sm"
          :class="{ 'font-medium': thread.unread }"
        >
          {{ thread.subject }}
        </p>
        <p class="truncate text-sm text-muted">
          {{ displaySnippet }}
        </p>
      </div>
      <div
        v-if="thread.unread"
        class="w-2 h-2 rounded-full bg-neutral-900 shrink-0 mt-2"
      />
    </div>
  </button>
</template>
