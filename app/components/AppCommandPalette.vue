<script setup lang="ts">
import type { CommandPaletteGroup } from '@nuxt/ui'

const props = defineProps<{
  open?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const open = computed({
  get: () => props.open ?? false,
  set: (v) => emit('update:open', v)
})

const router = useRouter()
const composeOpen = inject<Ref<boolean>>('mail:composeOpen')

const groups: CommandPaletteGroup[] = [
  {
    id: 'actions',
    label: 'Actions',
    items: [
      {
        label: 'Compose email',
        icon: 'i-lucide-pencil',
        onSelect: () => {
          composeOpen && (composeOpen.value = true)
          open.value = false
        }
      },
      {
        label: 'Summarize thread',
        icon: 'i-lucide-file-text',
        onSelect: () => { open.value = false }
      },
      {
        label: 'Draft reply',
        icon: 'i-lucide-reply',
        onSelect: () => { open.value = false }
      },
      {
        label: 'Create task',
        icon: 'i-lucide-check-square',
        onSelect: () => {
          router.push('/tasks')
          open.value = false
        }
      }
    ]
  },
  {
    id: 'navigation',
    label: 'Navigation',
    items: [
      {
        label: 'Go to inbox',
        icon: 'i-lucide-inbox',
        to: '/inbox',
        onSelect: () => {
          router.push('/inbox')
          open.value = false
        }
      },
      {
        label: 'Go to priority',
        icon: 'i-lucide-star',
        to: '/priority',
        onSelect: () => {
          router.push('/priority')
          open.value = false
        }
      },
      {
        label: 'Go to tasks',
        icon: 'i-lucide-check-square',
        to: '/tasks',
        onSelect: () => {
          router.push('/tasks')
          open.value = false
        }
      },
      {
        label: 'Search emails',
        icon: 'i-lucide-search',
        onSelect: () => { open.value = false }
      }
    ]
  }
]
</script>

<template>
  <UModal
    v-model:open="open"
    class="max-w-xl"
  >
    <template #content>
      <div class="p-0">
        <UCommandPalette
        :groups="groups"
        placeholder="Search commands..."
        class="border-0"
        @update:model-value="open = false"
      />
      </div>
    </template>
  </UModal>
</template>
