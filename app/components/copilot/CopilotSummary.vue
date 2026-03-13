<script setup lang="ts">
defineProps<{
  summary: string[]
}>()
</script>

<template>
  <section>
    <h4 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
      Thread Summary
    </h4>
    <ul class="space-y-1 text-sm">
      <li
        v-for="(item, i) in summary"
        :key="i"
        class="flex gap-2"
      >
        <span class="text-primary">•</span>
        <span>{{ item }}</span>
      </li>
    </ul>
  </section>
</template>
