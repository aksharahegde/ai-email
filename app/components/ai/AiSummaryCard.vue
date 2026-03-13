<script setup lang="ts">
defineProps<{
  summary: string[]
}>()
</script>

<template>
  <UCard
    v-if="summary.length"
    class="mb-4"
    data-testid="mail-ai-summary"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-sparkles" class="text-primary" />
        <span class="font-medium text-sm">AI Summary</span>
      </div>
    </template>
    <ul class="list-disc list-inside space-y-1 text-sm text-muted">
      <li
        v-for="(item, i) in summary"
        :key="i"
      >
        {{ item }}
      </li>
    </ul>
  </UCard>
</template>
