<script setup lang="ts">
import type { MailThread } from '~/types/mail'

const props = defineProps<{
  threads?: MailThread[]
  selectedId?: string | null
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const threads = computed(() => props.threads ?? [])
</script>

<template>
  <UScrollArea class="h-full">
    <div
      v-if="loading"
      class="p-4 text-center text-muted text-sm"
    >
      Loading...
    </div>
    <div
      v-else-if="threads.length"
      class="divide-y divide-default"
    >
      <MailListItem
        v-for="thread in threads"
        :key="thread.id"
        :thread="thread"
        :selected="selectedId === thread.id"
        @select="emit('select', $event)"
      />
    </div>
    <div
      v-else
      class="p-8 text-center text-muted text-sm"
    >
      <UIcon
        name="i-lucide-inbox"
        class="w-12 h-12 mx-auto mb-4 opacity-50"
      />
      <p>No emails</p>
    </div>
  </UScrollArea>
</template>
