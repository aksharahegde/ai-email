<script setup lang="ts">
defineProps<{
  items: Array<{ text: string; due?: string }>
  threadId: string
}>()
</script>

<template>
  <section v-if="items.length">
    <h4 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
      Action Items
    </h4>
    <div class="space-y-2">
      <div
        v-for="(item, i) in items"
        :key="i"
        class="flex items-center justify-between gap-2 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800/50"
      >
        <div>
          <p class="text-sm font-medium">{{ item.text }}</p>
          <p
            v-if="item.due"
            class="text-xs text-muted"
          >
            Due: {{ item.due }}
          </p>
        </div>
        <div class="flex gap-1 shrink-0">
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-check"
            aria-label="Mark done"
          />
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-plus"
            aria-label="Create task"
          />
        </div>
      </div>
    </div>
  </section>
</template>
