<script setup lang="ts">
const props = defineProps<{
  items: Array<{ text: string, due?: string }>
  threadId: string
}>()

type ItemState = { dismissed: boolean, taskId: string | null }

const states = ref<Record<string, ItemState>>({})
const loading = ref<Record<string, 'dismiss' | 'add' | null>>({})

// Fetch persisted states when threadId or items change
watch(() => [props.threadId, props.items] as const, async () => {
  if (!props.threadId || !props.items.length) return
  const { states: s } = await $fetch<{ states: Record<string, ItemState> }>(
    `/api/action-items/states?threadId=${props.threadId}`
  )
  states.value = s
}, { immediate: true })

const visibleItems = computed(() =>
  props.items.filter(item => !states.value[item.text]?.dismissed)
)

async function dismiss(item: { text: string, due?: string }) {
  loading.value[item.text] = 'dismiss'
  try {
    await $fetch('/api/action-items/dismiss', {
      method: 'POST',
      body: { threadId: props.threadId, itemText: item.text }
    })
    states.value[item.text] = { ...states.value[item.text], dismissed: true, taskId: states.value[item.text]?.taskId ?? null }
  } finally {
    loading.value[item.text] = null
  }
}

async function addTask(item: { text: string, due?: string }) {
  if (states.value[item.text]?.taskId) return // already added
  loading.value[item.text] = 'add'
  try {
    const { taskId } = await $fetch<{ taskId: string }>('/api/action-items/add-task', {
      method: 'POST',
      body: { threadId: props.threadId, itemText: item.text, due: item.due }
    })
    states.value[item.text] = { ...states.value[item.text], dismissed: false, taskId }
  } finally {
    loading.value[item.text] = null
  }
}
</script>

<template>
  <section v-if="visibleItems.length">
    <h4 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
      Action Items
    </h4>
    <div class="space-y-2">
      <div
        v-for="item in visibleItems"
        :key="item.text"
        class="flex items-center justify-between gap-2 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800/50"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">
            {{ item.text }}
          </p>
          <p v-if="item.due" class="text-xs text-muted">
            Due: {{ item.due }}
          </p>
        </div>
        <div class="flex gap-1 shrink-0">
          <!-- Tick: dismiss from list -->
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-check"
            aria-label="Dismiss"
            :loading="loading[item.text] === 'dismiss'"
            @click="dismiss(item)"
          />
          <!-- Plus: add to tasks -->
          <UTooltip :text="states[item.text]?.taskId ? 'Added to tasks' : 'Add to tasks'">
            <UButton
              size="xs"
              :variant="states[item.text]?.taskId ? 'soft' : 'ghost'"
              :color="states[item.text]?.taskId ? 'success' : 'neutral'"
              :icon="states[item.text]?.taskId ? 'i-lucide-check-check' : 'i-lucide-plus'"
              aria-label="Add to tasks"
              :loading="loading[item.text] === 'add'"
              :disabled="!!states[item.text]?.taskId"
              @click="addTask(item)"
            />
          </UTooltip>
        </div>
      </div>
    </div>
  </section>
</template>
