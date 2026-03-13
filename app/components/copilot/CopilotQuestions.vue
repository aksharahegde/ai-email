<script setup lang="ts">
defineProps<{
  questions: string[]
  threadId: string
}>()
</script>

<template>
  <section v-if="questions.length">
    <h4 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
      Questions Detected
    </h4>
    <div class="space-y-2">
      <div
        v-for="(q, i) in questions"
        :key="i"
        class="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-sm"
      >
        <p class="mb-2">
          {{ q }}
        </p>
        <UButton
          size="xs"
          variant="soft"
          icon="i-lucide-pencil"
        >
          Draft Reply
        </UButton>
      </div>
    </div>
  </section>
</template>
