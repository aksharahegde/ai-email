<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

const { data } = useFetch<{ drafts: Array<{ id: string, to: string, subject: string, preview: string }> }>('/api/gmail/drafts', {
  default: () => ({ drafts: [] })
})

const drafts = computed(() => data.value?.drafts ?? [])
</script>

<template>
  <div class="p-4">
    <h1 class="text-xl font-semibold mb-4">
      Drafts
    </h1>
    <div
      v-if="drafts.length"
      class="space-y-2"
    >
      <UCard
        v-for="d in drafts"
        :key="d.id"
        class="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
      >
        <p class="font-medium">
          {{ d.subject }}
        </p>
        <p class="text-sm text-muted">
          To: {{ d.to }}
        </p>
        <p class="text-sm text-muted truncate">
          {{ d.preview }}
        </p>
      </UCard>
    </div>
    <UEmpty
      v-else
      title="No drafts"
      description="Your draft emails will appear here"
      icon="i-lucide-file-edit"
    />
  </div>
</template>
