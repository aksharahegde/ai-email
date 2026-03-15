<script setup lang="ts">
import type { MailMessage as MailMessageType } from '~/types/mail'

const props = defineProps<{
  message: MailMessageType
}>()

function formatDateTime(date: Date) {
  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

const isHtml = computed(() => /<[a-z][\s\S]*>/i.test(props.message.body))

const renderedBody = computed(() => {
  if (isHtml.value) return props.message.body
  return props.message.body.replace(/\n/g, '<br>')
})
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
      <iframe
        v-if="isHtml"
        :srcdoc="renderedBody"
        sandbox="allow-same-origin"
        class="mt-2 w-full border-0 min-h-40"
        style="height: 0"
        @load="(e) => {
          const iframe = e.target as HTMLIFrameElement
          iframe.style.height = iframe.contentDocument?.body?.scrollHeight + 'px'
        }"
      />
      <div
        v-else
        class="mt-2 text-sm prose dark:prose-invert max-w-none"
        v-html="renderedBody"
      />
    </div>
  </div>
</template>
