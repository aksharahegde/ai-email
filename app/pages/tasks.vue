<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

type Task = { id: string; text: string; due?: string | null; source: string; done: boolean }

const { data, status } = useFetch<{ tasks: Task[] }>('/api/ai/tasks-from-emails', {
  default: () => ({ tasks: [] })
})

const tasks = ref<Task[]>([])
watch(() => data.value?.tasks, (t) => {
  tasks.value = (t ?? []).map(x => ({ ...x, done: false }))
}, { immediate: true })

function toggleDone(id: string) {
  const t = tasks.value.find(x => x.id === id)
  if (t) t.done = !t.done
}
</script>

<template>
  <div class="p-4">
    <h1 class="text-xl font-semibold mb-4">
      Tasks from Email
    </h1>
    <div
      v-if="status === 'pending'"
      class="py-8 text-center text-muted text-sm"
    >
      Extracting tasks from recent emails...
    </div>
    <div
      v-else-if="tasks.length"
      class="grid gap-4 md:grid-cols-2"
    >
      <UCard
        v-for="task in tasks"
        :key="task.id"
        class="flex gap-4"
        data-testid="task-row"
      >
        <UCheckbox
          :model-value="task.done"
          class="shrink-0 mt-1"
          @update:model-value="toggleDone(task.id)"
        />
        <div class="flex-1 min-w-0">
          <p
            class="font-medium"
            :class="{ 'line-through text-muted': task.done }"
          >
            {{ task.text }}
          </p>
          <p
            v-if="task.due"
            class="text-sm text-muted mt-1"
          >
            Due: {{ task.due }}
          </p>
          <p class="text-xs text-muted mt-1">
            Source: {{ task.source }}
          </p>
        </div>
      </UCard>
    </div>
    <UEmpty
      v-else
      title="No tasks found"
      description="Tasks are extracted from your recent emails. Try again after receiving more emails."
      icon="i-lucide-list-todo"
    />
  </div>
</template>
