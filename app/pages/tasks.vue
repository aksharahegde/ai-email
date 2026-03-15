<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const selectedThreadId = inject<Ref<string | null>>('mail:selectedThread')!

type Task = {
  id: string
  text: string
  due: string | null
  done: boolean
  threadId: string
  subject: string
  from: { name: string, email: string }
}

const { data, refresh } = useFetch<{ tasks: Task[], extracting: boolean }>('/api/tasks', {
  default: () => ({ tasks: [], extracting: false })
})

const tasks = ref<Task[]>([])
watch(() => data.value?.tasks, (t) => {
  if (t) tasks.value = t
}, { immediate: true })

const extracting = computed(() => data.value?.extracting ?? false)

// Poll while extracting
let pollInterval: ReturnType<typeof setInterval> | null = null
watch(extracting, (val) => {
  if (val && !pollInterval) {
    pollInterval = setInterval(async () => {
      await refresh()
      if (!data.value?.extracting) {
        clearInterval(pollInterval!)
        pollInterval = null
      }
    }, 3000)
  }
}, { immediate: true })

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

const pending = computed(() => tasks.value.filter(t => !t.done).length)
const completed = computed(() => tasks.value.filter(t => t.done).length)

async function toggleDone(task: Task) {
  task.done = !task.done
  await $fetch(`/api/tasks/${task.id}`, {
    method: 'PATCH',
    body: { done: task.done }
  })
}

async function triggerExtraction() {
  await $fetch('/api/tasks/extract', { method: 'POST' })
  await refresh()
}

function openThread(threadId: string) {
  if (selectedThreadId) {
    selectedThreadId.value = selectedThreadId.value === threadId ? null : threadId
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-default shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-square-check-big" class="w-5 h-5 text-primary" />
          <h1 class="text-lg font-semibold">Tasks from Email</h1>
        </div>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="extracting"
          aria-label="Re-extract tasks"
          @click="triggerExtraction"
        />
      </div>
      <p class="text-sm text-muted mt-0.5">
        {{ pending }} pending • {{ completed }} completed
      </p>
    </div>

    <!-- Extracting (first run) -->
    <div
      v-if="extracting && tasks.length === 0"
      class="flex-1 flex flex-col items-center justify-center gap-3 text-muted"
    >
      <UIcon name="i-lucide-loader-2" class="animate-spin w-6 h-6" />
      <p class="text-sm">Extracting tasks from your emails…</p>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!extracting && tasks.length === 0"
      class="flex-1 flex flex-col items-center justify-center gap-2 text-muted"
    >
      <UIcon name="i-lucide-list-todo" class="w-8 h-8 opacity-30" />
      <p class="text-sm">No tasks found in your emails</p>
    </div>

    <!-- Task list -->
    <div v-else class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="border border-default rounded-xl p-4 flex items-start gap-3 transition-opacity"
        :class="{ 'opacity-50': task.done }"
      >
        <UCheckbox
          :model-value="task.done"
          class="mt-0.5 shrink-0"
          @update:model-value="toggleDone(task)"
        />
        <div class="flex-1 min-w-0">
          <p
            class="font-semibold text-sm leading-snug"
            :class="{ 'line-through text-muted': task.done }"
          >
            {{ task.text }}
          </p>
          <div class="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
            <span
              v-if="task.due"
              class="flex items-center gap-1 text-orange-500 font-medium"
            >
              <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5 shrink-0" />
              {{ task.due }}
            </span>
            <button
              class="flex items-center gap-1 text-muted hover:text-foreground transition-colors min-w-0"
              @click="openThread(task.threadId)"
            >
              <UIcon name="i-lucide-mail" class="w-3.5 h-3.5 shrink-0" />
              <span class="truncate">{{ task.from.name || task.from.email }} — {{ task.subject }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
