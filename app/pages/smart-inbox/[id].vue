<script setup lang="ts">
import type { MailThread } from '~/types/mail'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const id = computed(() => route.params.id as string)

const selectedThreadId = inject<Ref<string | null>>('mail:selectedThread')!

// Fetch smart inbox item metadata
const { data: itemData } = useFetch<{
  item: {
    id: string
    name: string
    classificationPrompt: string
    summarizationPrompt: string | null
    scanScope: number
  } | null
}>(
  () => `/api/smart-inbox/${id.value}`,
  { default: () => ({ item: null }) }
)
const item = computed(() => itemData.value?.item)

// Fetch threads (cached classification results)
const { data: threadsData, refresh } = useFetch<{
  threads: Array<{
    id: string
    subject: string
    snippet: string
    participants: { name: string, email: string }[]
    unread: boolean
    lastMessageAt: number
    timestamp: Date
    summary: string
    classifiedAt: number
  }>
  syncing: boolean
  lastClassifiedAt: number | null
}>(
  () => `/api/smart-inbox/${id.value}/threads`,
  {
    default: () => ({ threads: [], syncing: false, lastClassifiedAt: null }),
    watch: [id]
  }
)

const threads = computed<Array<MailThread & { summary: string }>>(() =>
  (threadsData.value?.threads ?? []).map(t => ({
    id: t.id,
    subject: t.subject,
    snippet: t.snippet,
    participants: t.participants,
    unread: t.unread,
    messageCount: 0,
    timestamp: new Date(t.lastMessageAt * 1000),
    summary: t.summary
  }))
)
const syncing = computed(() => threadsData.value?.syncing ?? false)
const lastClassifiedAt = computed(() => threadsData.value?.lastClassifiedAt ?? null)

// Poll while syncing
let pollInterval: ReturnType<typeof setInterval> | null = null

watch(syncing, (val) => {
  if (val && !pollInterval) {
    pollInterval = setInterval(async () => {
      await refresh()
      if (!threadsData.value?.syncing) {
        clearInterval(pollInterval!)
        pollInterval = null
      }
    }, 5000)
  }
}, { immediate: true })

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

function formatSyncTime(ts: number | null) {
  if (!ts) return null
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  return `${Math.floor(diff / 3600)}h ago`
}

// Edit modal
const editOpen = ref(false)

async function onSaved() {
  editOpen.value = false
  await refresh()
}

// Thread selection
function onSelectThread(threadId: string) {
  if (selectedThreadId) {
    selectedThreadId.value = selectedThreadId.value === threadId ? null : threadId
  }
}

const selectedThread = computed(() =>
  selectedThreadId?.value
    ? threads.value.find(t => t.id === selectedThreadId.value) ?? null
    : null
)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-default flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <h2 class="font-semibold text-sm">{{ item?.name ?? '…' }}</h2>
        <div v-if="syncing" class="flex items-center gap-1 text-xs text-muted">
          <UIcon name="i-lucide-loader-2" class="animate-spin w-3 h-3" />
          Syncing…
        </div>
      </div>
      <UButton
        v-if="item"
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Edit smart inbox"
        @click="editOpen = true"
      />
    </div>

    <!-- Thread list or empty state -->
    <div
      v-if="!selectedThread"
      class="flex-1 overflow-hidden flex flex-col"
    >
      <!-- Syncing empty state (first classification) -->
      <div
        v-if="syncing && threads.length === 0"
        class="flex-1 flex flex-col items-center justify-center gap-3 text-muted"
      >
        <UIcon name="i-lucide-loader-2" class="animate-spin w-6 h-6" />
        <p class="text-sm">Classifying your emails…</p>
      </div>

      <!-- No results after sync -->
      <div
        v-else-if="!syncing && threads.length === 0"
        class="flex-1 flex flex-col items-center justify-center gap-2 text-muted"
      >
        <UIcon name="i-lucide-inbox" class="w-8 h-8 opacity-30" />
        <p class="text-sm">No emails matched your prompt</p>
      </div>

      <!-- Thread list -->
      <div v-else class="flex-1 overflow-y-auto">
        <MailListItem
          v-for="thread in threads"
          :key="thread.id"
          :thread="thread"
          :selected="selectedThreadId === thread.id"
          :summary="thread.summary"
          @select="onSelectThread"
        />
      </div>

      <!-- Footer -->
      <div class="px-4 py-2 border-t border-default flex items-center justify-between text-xs text-muted shrink-0">
        <span>{{ threads.length }} email{{ threads.length !== 1 ? 's' : '' }} matched</span>
        <span v-if="lastClassifiedAt">Last synced {{ formatSyncTime(lastClassifiedAt) }}</span>
      </div>
    </div>

    <!-- Thread detail view -->
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

  <!-- Edit modal -->
  <SmartInboxModal
    v-if="item"
    v-model:open="editOpen"
    :item="item"
    @saved="onSaved"
  />
</template>
