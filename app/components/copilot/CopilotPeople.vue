<script setup lang="ts">
import type { ThreadAnalysis } from '~/types/mail'

defineProps<{
  people: ThreadAnalysis['people']
}>()
</script>

<template>
  <section v-if="people.length">
    <h4 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
      People
    </h4>
    <div class="space-y-2">
      <div
        v-for="p in people"
        :key="p.email"
        class="flex items-start gap-2 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
      >
        <UAvatar
          :alt="p.name"
          size="sm"
        >
          {{ p.name.charAt(0) }}
        </UAvatar>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-sm">
            {{ p.name }}
          </p>
          <p
            v-if="p.company"
            class="text-xs text-muted"
          >
            {{ p.company }}
          </p>
          <p
            v-if="p.lastInteraction"
            class="text-xs text-muted"
          >
            Last: {{ p.lastInteraction }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
