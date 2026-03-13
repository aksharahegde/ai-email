<script setup lang="ts">
import type { MailMessage as MailMessageType } from '~/types/mail'

defineProps<{
  message: MailMessageType
}>()

function formatDateTime(date: Date) {
  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}
</script>

<template>
  <div class="flex gap-3 py-4 border-b border-default last:border-0">
    <UAvatar
      :alt="message.from.name"
      :src="message.from.avatar"
      size="sm"
    />
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-medium">{{ message.from.name }}</span>
        <span class="text-sm text-muted">
          {{ formatDateTime(message.timestamp) }}
        </span>
      </div>
      <div
        class="mt-2 text-sm prose dark:prose-invert max-w-none"
        v-html="message.body.replace(/\n/g, '<br>')"
      />
    </div>
  </div>
</template>
