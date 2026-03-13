<script setup lang="ts">
const selectedThreadId = ref<string | null>(null)
const composeOpen = ref(false)
const commandPaletteOpen = ref(false)
const colorMode = useColorMode()

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
        <div class="p-4 flex items-center gap-2">
          <span class="font-bold tracking-tight text-lg">Neuron Mail</span>
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
        :default-size="50"
        :max-size="70"
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
            <template #right>
              <UButton
                :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
                color="neutral"
                variant="ghost"
                aria-label="Toggle theme"
                @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
              />
            </template>
          </UDashboardNavbar>
        </template>

        <slot />
      </UDashboardPanel>

      <UDashboardPanel
        id="mail-copilot"
        class="hidden lg:flex"
        :min-size="22"
        :default-size="30"
        :max-size="45"
        resizable
      >
        <template #header>
          <div class="px-4 py-3 border-b border-default">
            <h3 class="font-medium text-sm text-muted">
              AI Copilot
            </h3>
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
</template>
