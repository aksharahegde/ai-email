<script setup lang="ts">
import type { AiTag } from '~/types/mail'

const props = defineProps<{
  tag: AiTag
}>()

const tagConfig: Record<AiTag, { label: string; color: 'error' | 'warning' | 'blue' | 'purple' | 'neutral' }> = {
  'action-required': { label: 'Action Required', color: 'error' },
  'question':        { label: 'Question',         color: 'warning' },
  'decision':        { label: 'Decision',          color: 'blue' },
  'meeting':         { label: 'Meeting',           color: 'purple' },
  'fyi':             { label: 'FYI',               color: 'neutral' }
}

const config = computed(() => tagConfig[props.tag])
</script>

<template>
  <UBadge
    v-if="config"
    :color="config.color"
    variant="subtle"
    size="xs"
  >
    {{ config.label }}
  </UBadge>
</template>
