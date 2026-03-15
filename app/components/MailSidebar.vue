<script setup lang="ts">
const { data, refresh: refreshItems } = useFetch<{
  items: Array<{
    id: string
    name: string
    classifying: number
    lastClassifiedAt: number | null
  }>
}>('/api/smart-inbox', { default: () => ({ items: [] }) })

const smartInboxItems = computed(() => data.value?.items ?? [])

// Modal state
const modalOpen = ref(false)
const editingItem = ref<{ id: string, name: string, classificationPrompt: string, summarizationPrompt?: string | null, scanScope: number } | null>(null)

function openCreate() {
  editingItem.value = null
  modalOpen.value = true
}

async function openEdit(id: string) {
  const res = await $fetch<{ item: any }>(`/api/smart-inbox/${id}`)
  editingItem.value = res.item
  modalOpen.value = true
}

async function deleteItem(id: string) {
  if (!confirm('Delete this Smart Inbox?')) return
  await $fetch(`/api/smart-inbox/${id}`, { method: 'DELETE' })
  await refreshItems()
}

async function onSaved() {
  modalOpen.value = false
  await refreshItems()
}

const mailNavItems = [
  [
    { type: 'label', label: 'Mail' },
    { label: 'Tasks', icon: 'i-lucide-square-check-big', to: '/tasks' },
    { label: 'Sent', icon: 'i-lucide-send', to: '/sent' },
    { label: 'Drafts', icon: 'i-lucide-file-edit', to: '/drafts' },
    { label: 'Archive', icon: 'i-lucide-archive', to: '/archive' }
  ],
  [
    { type: 'label', label: 'Labels' },
    { label: 'Work', icon: 'i-lucide-briefcase', to: '/inbox?label=work' },
    { label: 'Personal', icon: 'i-lucide-user', to: '/inbox?label=personal' },
    { label: 'Finance', icon: 'i-lucide-wallet', to: '/inbox?label=finance' },
    { label: 'Travel', icon: 'i-lucide-plane', to: '/inbox?label=travel' }
  ]
]
</script>

<template>
  <div class="flex-1 px-2 py-4 flex flex-col gap-1 overflow-y-auto">
    <!-- Inbox -->
    <div class="px-2 pb-1">
      <span class="text-xs font-semibold text-muted uppercase tracking-wider">Inbox</span>
    </div>
    <UButton
      to="/inbox"
      variant="ghost"
      color="neutral"
      icon="i-lucide-inbox"
      class="w-full justify-start"
    >
      Inbox
    </UButton>

    <!-- Smart Inbox -->
    <div class="mt-3 px-2 pb-1 flex items-center justify-between">
      <span class="text-xs font-semibold text-muted uppercase tracking-wider">Smart Inbox</span>
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Add smart inbox"
        @click="openCreate"
      />
    </div>

    <div
      v-for="item in smartInboxItems"
      :key="item.id"
      class="group relative"
    >
      <UButton
        :to="`/smart-inbox/${item.id}`"
        variant="ghost"
        color="neutral"
        class="w-full justify-start pr-16"
      >
        <template #leading>
          <span class="w-2 h-2 rounded-full bg-primary shrink-0" />
        </template>
        {{ item.name }}
      </UButton>
      <!-- Edit / Delete — visible on hover -->
      <div class="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Edit"
          @click.prevent="openEdit(item.id)"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Delete"
          @click.prevent="deleteItem(item.id)"
        />
      </div>
    </div>

    <!-- Add smart inbox link -->
    <button
      class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors rounded-md"
      @click="openCreate"
    >
      <span class="w-4 h-4 border border-dashed border-muted rounded-full flex items-center justify-center text-xs">+</span>
      Add smart inbox
    </button>

    <!-- Mail + Labels -->
    <div class="mt-3">
      <UNavigationMenu
        orientation="vertical"
        :items="mailNavItems"
      />
    </div>
  </div>

  <!-- Create/Edit Modal -->
  <SmartInboxModal
    v-model:open="modalOpen"
    :item="editingItem"
    @saved="onSaved"
  />
</template>
