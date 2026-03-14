<script setup lang="ts">
const props = defineProps<{
  open: boolean
  item?: {
    id: string
    name: string
    classificationPrompt: string
    summarizationPrompt?: string | null
    scanScope: number
  } | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const isEdit = computed(() => !!props.item?.id)
const title = computed(() => isEdit.value ? 'Edit Smart Inbox' : 'New Smart Inbox')

const form = reactive({
  name: '',
  classificationPrompt: '',
  summarizationPrompt: '',
  scanScope: 50 as 50 | 200 | 500
})

watch(() => props.open, (open) => {
  if (open) {
    form.name = props.item?.name ?? ''
    form.classificationPrompt = props.item?.classificationPrompt ?? ''
    form.summarizationPrompt = props.item?.summarizationPrompt ?? ''
    form.scanScope = (props.item?.scanScope as 50 | 200 | 500) ?? 50
  }
})

const saving = ref(false)
const error = ref<string | null>(null)

const scopeOptions = [
  { label: '50 emails', value: 50 },
  { label: '200 emails', value: 200 },
  { label: '500 emails', value: 500 }
]

async function save() {
  if (!form.name.trim() || !form.classificationPrompt.trim()) {
    error.value = 'Name and classification prompt are required'
    return
  }

  saving.value = true
  error.value = null

  try {
    const payload = {
      name: form.name.trim(),
      classificationPrompt: form.classificationPrompt.trim(),
      summarizationPrompt: form.summarizationPrompt.trim() || null,
      scanScope: form.scanScope
    }

    if (isEdit.value) {
      await $fetch(`/api/smart-inbox/${props.item!.id}`, { method: 'PUT', body: payload })
    } else {
      await $fetch('/api/smart-inbox', { method: 'POST', body: payload })
    }

    emit('saved')
  } catch (err: any) {
    error.value = err?.data?.message ?? 'Something went wrong'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    description="AI will classify emails into this inbox based on your prompts"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Name" required>
          <UInput
            v-model="form.name"
            placeholder="e.g. Invoices, Needs Reply, Newsletters…"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Classification prompt" required>
          <p class="text-xs text-muted mb-1">
            AI reads each email and uses this to decide if it belongs here.
          </p>
          <UTextarea
            v-model="form.classificationPrompt"
            placeholder="Does this email contain an invoice or payment request?"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Summarization prompt">
          <p class="text-xs text-muted mb-1">
            How AI summarizes each matching email. Optional — falls back to email snippet.
          </p>
          <UTextarea
            v-model="form.summarizationPrompt"
            placeholder="Extract: vendor name, amount due, due date, payment status."
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Scan scope">
          <div class="flex w-full">
            <UButton
              v-for="opt in scopeOptions"
              :key="opt.value"
              :variant="form.scanScope === opt.value ? 'solid' : 'outline'"
              color="neutral"
              class="flex-1 rounded-none first:rounded-s-md last:rounded-e-md"
              @click="form.scanScope = opt.value as 50 | 200 | 500"
            >
              {{ opt.label }}
            </UButton>
          </div>
        </UFormField>

        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          @click="emit('update:open', false)"
        >
          Cancel
        </UButton>
        <UButton
          :loading="saving"
          @click="save"
        >
          {{ isEdit ? 'Save Changes' : 'Create & Sync' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
