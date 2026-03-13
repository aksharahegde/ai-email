<script setup lang="ts">
defineProps<{
  decisions: string[]
}>()
</script>

<template>
  <section v-if="decisions.length">
    <h4 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
      Decisions
    </h4>
    <ul class="space-y-1 text-sm">
      <li
        v-for="(d, i) in decisions"
        :key="i"
        class="flex gap-2"
      >
        <UIcon name="i-lucide-gavel" class="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
        <span>{{ d }}</span>
      </li>
    </ul>
  </section>
</template>
