<script setup lang="ts">
import type { ThreadAnalysis } from '~/types/mail'

const props = defineProps<{
  threadId?: string | null
}>()

const { data: analysis, status: analysisStatus } = useAsyncData<ThreadAnalysis | null>(
  () => `copilot-${props.threadId}`,
  () => {
    if (!props.threadId) return null
    return $fetch<ThreadAnalysis>(`/api/ai/thread-analysis?threadId=${props.threadId}`)
  },
  { watch: [() => props.threadId], default: () => null }
)
</script>

<template>
  <div class="p-4 space-y-6">
    <div
      v-if="analysisStatus === 'pending' && threadId"
      class="text-center py-12 text-muted text-sm"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin"
      />
      <p>Analyzing thread...</p>
    </div>
    <template v-else-if="analysis && threadId">
      <CopilotSummary :summary="analysis.summary" />
      <CopilotActions
        :items="analysis.actionItems"
        :thread-id="threadId"
      />
      <CopilotQuestions
        :questions="analysis.questions"
        :thread-id="threadId"
      />
      <CopilotDecisions :decisions="analysis.decisions" />
      <CopilotPeople :people="analysis.people" />
    </template>
    <div
      v-else
      class="text-center py-12 text-muted text-sm"
    >
      <UIcon
        name="i-lucide-mail-open"
        class="w-12 h-12 mx-auto mb-4 opacity-50"
      />
      <p>Select an email thread to see AI insights</p>
    </div>
  </div>
</template>
