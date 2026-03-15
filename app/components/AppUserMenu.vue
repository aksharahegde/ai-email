<script setup lang="ts">
const { user, clear } = useUserSession()

async function signOut() {
  await clear()
  window.location.replace('/')
}

const menuItems = computed(() => [
  [
    { label: user.value?.name ?? 'Account', icon: 'i-lucide-user', disabled: true },
    { type: 'separator' },
    { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
    { label: 'AI Settings', icon: 'i-lucide-sparkles', to: '/settings/ai' },
    { type: 'separator' },
    { label: 'Sign out', icon: 'i-lucide-log-out', onSelect: signOut }
  ]
])
</script>

<template>
  <UDropdownMenu
    :items="menuItems"
    class="w-full"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      class="justify-start"
      data-testid="mail-user-menu-trigger"
    >
      <UAvatar
        :alt="user?.name"
        :src="user?.picture"
        size="xs"
      />
      <span class="truncate ml-2">{{ user?.name ?? 'Account' }}</span>
    </UButton>
  </UDropdownMenu>
</template>
