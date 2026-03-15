<script setup lang="ts">
import type { ThreadAnalysis } from '~/types/mail'

const props = defineProps<{
  threadId?: string | null
}>()

const triggered = ref(false)
const analysis = ref<ThreadAnalysis | null>(null)
const analysisStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')

// Reset when thread changes
watch(() => props.threadId, () => {
  triggered.value = false
  analysis.value = null
  analysisStatus.value = 'idle'
})

async function analyze() {
  if (!props.threadId) return
  triggered.value = true
  analysisStatus.value = 'pending'
  try {
    analysis.value = await $fetch<ThreadAnalysis>(`/api/ai/thread-analysis?threadId=${props.threadId}`)
    analysisStatus.value = 'success'
  } catch {
    analysisStatus.value = 'error'
  }
}
</script>

<template>
  <div class="p-4 space-y-6">
    <!-- No thread selected -->
    <div
      v-if="!threadId"
      class="text-center py-12 text-muted text-sm"
    >
      <UIcon name="i-lucide-mail-open" class="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>Select an email thread to see AI insights</p>
    </div>

    <!-- Thread selected, not yet triggered -->
    <div
      v-else-if="!triggered"
      class="text-center py-12 text-muted text-sm"
    >
      <UIcon name="i-lucide-sparkles" class="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p class="mb-4">Analyze this thread with AI</p>
      <UButton
        icon="i-lucide-sparkles"
        size="sm"
        @click="analyze"
      >
        Analyze
      </UButton>
    </div>

    <!-- Loading -->
    <div
      v-else-if="analysisStatus === 'pending'"
      class="text-center py-12 text-muted text-sm"
    >
      <UIcon name="i-lucide-loader-2" class="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" />
      <p>Analyzing thread...</p>
    </div>

    <!-- Error -->
    <div
      v-else-if="analysisStatus === 'error'"
      class="text-center py-12 text-muted text-sm"
    >
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p class="mb-4">Analysis failed</p>
      <UButton size="sm" variant="outline" color="neutral" @click="analyze">
        Retry
      </UButton>
    </div>

    <!-- Results -->
    <template v-else-if="analysis">
      <CopilotSummary :summary="analysis.summary" />
      <CopilotActions :items="analysis.actionItems" :thread-id="threadId!" />
      <CopilotQuestions :questions="analysis.questions" :thread-id="threadId!" />
      <CopilotDecisions :decisions="analysis.decisions" />
      <CopilotPeople :people="analysis.people" />
    </template>
  </div>
</template>
