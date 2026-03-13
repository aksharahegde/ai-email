<script setup lang="ts">
import type { MailThread } from '~/types/mail'

definePageMeta({ layout: 'dashboard' })

const selectedThreadId = inject<Ref<string | null>>('mail:selectedThread')!
const { threads, status: threadsStatus, refresh } = useThreads({ limit: 50 })

const displayThreads = computed<MailThread[]>(() =>
  threads.value.map(t => ({
    id: t.id,
    subject: t.subject,
    snippet: t.snippet,
    participants: t.participants,
    unread: t.unread,
    messageCount: t.messageCount,
    timestamp: t.timestamp
  }))
)

const selectedThread = computed(() =>
  selectedThreadId?.value
    ? displayThreads.value.find(t => t.id === selectedThreadId.value) ?? null
    : null
)

function onSelectThread(id: string) {
  if (selectedThreadId) {
    selectedThreadId.value = selectedThreadId.value === id ? null : id
  }
}

// --- refresh / sync ---
const syncing = ref(false)
const lastSyncedAt = ref<number | null>(null)

async function triggerRefresh() {
  syncing.value = true
  await $fetch('/api/sync/gmail')

  // Poll until done
  const interval = setInterval(async () => {
    const status = await $fetch<{ syncing: boolean, newCount: number }>('/api/sync/gmail/status')
    if (!status.syncing) {
      clearInterval(interval)
      syncing.value = false
      lastSyncedAt.value = Math.floor(Date.now() / 1000)
      await refresh()
    }
  }, 3000)
}

function formatSyncTime(ts: number | null) {
  if (!ts) return null
  const diff = Math.floor((Date.now() / 1000) - ts)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  return `${Math.floor(diff / 3600)}h ago`
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div
      v-if="!selectedThread"
      class="flex-1 overflow-hidden flex flex-col"
    >
      <MailList
        :threads="displayThreads"
        :selected-id="selectedThreadId ?? null"
        :loading="threadsStatus === 'pending'"
        @select="onSelectThread"
      />
      <div class="px-4 py-2 border-t border-default flex items-center justify-between text-xs text-muted shrink-0">
        <span v-if="lastSyncedAt">Last synced {{ formatSyncTime(lastSyncedAt) }}</span>
        <span v-else>Loaded from local cache</span>
        <button
          class="underline hover:text-foreground transition-colors"
          :disabled="syncing"
          @click="triggerRefresh"
        >
          {{ syncing ? 'Syncing…' : 'Refresh' }}
        </button>
      </div>
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
