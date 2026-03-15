<script setup lang="ts">
const selectedThreadId = ref<string | null>(null)
const composeOpen = ref(false)
const commandPaletteOpen = ref(false)
const colorMode = useColorMode()

// Copilot prompt settings
const promptModalOpen = ref(false)
const promptDraft = ref('')
const promptSaving = ref(false)

async function openPromptModal() {
  const { prompt } = await $fetch<{ prompt: string }>('/api/settings/copilot')
  promptDraft.value = prompt
  promptModalOpen.value = true
}

async function savePrompt() {
  promptSaving.value = true
  try {
    await $fetch('/api/settings/copilot', { method: 'POST', body: { prompt: promptDraft.value } })
    promptModalOpen.value = false
  } finally {
    promptSaving.value = false
  }
}

provide('mail:selectedThread', selectedThreadId as Ref<string | null>)
provide('mail:composeOpen', composeOpen as Ref<boolean>)
provide('mail:commandPaletteOpen', commandPaletteOpen)

defineShortcuts({
  meta_k: {
    usingInput: true,
    handler: () => {
      commandPaletteOpen.value = true
    }
  }
})
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      resizable
      collapsible
      :min-size="15"
      :default-size="20"
      :max-size="30"
    >
      <template #header>
        <div class="p-4 flex items-center">
          <span class="font-bold tracking-tight text-lg">YuktiMail</span>
        </div>
      </template>

      <MailSidebar />

      <template #footer>
        <AppUserMenu />
      </template>
    </UDashboardSidebar>

    <div class="flex flex-1 min-w-0">
      <UDashboardPanel
        id="mail-center"
        :min-size="35"
        :default-size="65"
        :max-size="75"
        resizable
      >
        <template #header>
          <UDashboardNavbar>
            <template #left>
              <MailSearch />
              <UButton
                icon="i-lucide-command"
                color="neutral"
                variant="ghost"
                aria-label="Command palette"
                @click="commandPaletteOpen = true"
              />
              <UButton
                icon="i-lucide-pencil"
                color="primary"
                data-testid="mail-compose-trigger"
                @click="composeOpen = true"
              >
                Compose
              </UButton>
            </template>
          </UDashboardNavbar>
        </template>

        <slot />
      </UDashboardPanel>

      <UDashboardPanel
        class="hidden lg:flex"
      >
        <template #header>
          <div class="px-4 py-3 border-b border-default flex items-center justify-between">
            <h3 class="font-medium text-sm text-muted">
              AI Copilot
            </h3>
            <div class="flex items-center gap-1">
              <UTooltip text="Edit analysis prompt">
                <UButton
                  icon="i-lucide-sliders-horizontal"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Edit analysis prompt"
                  @click="openPromptModal"
                />
              </UTooltip>
              <UButton
                :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
                color="neutral"
                variant="ghost"
                size="sm"
                aria-label="Toggle theme"
                @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
              />
            </div>
          </div>
        </template>

        <template #body>
          <CopilotPanel :thread-id="selectedThreadId" />
        </template>
      </UDashboardPanel>
    </div>
  </UDashboardGroup>

  <MailCompose v-model:open="composeOpen" />
  <AppCommandPalette v-model:open="commandPaletteOpen" />

  <UModal
    v-model:open="promptModalOpen"
    title="Analysis Prompt"
    description="Customize what the AI extracts when analyzing an email thread. Changing this clears cached analyses."
  >
    <template #body>
      <UTextarea
        v-model="promptDraft"
        :rows="10"
        class="w-full font-mono text-sm"
      />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="promptModalOpen = false">
          Cancel
        </UButton>
        <UButton :loading="promptSaving" @click="savePrompt">
          Save & Apply
        </UButton>
      </div>
    </template>
  </UModal>
</template>
