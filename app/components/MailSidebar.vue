<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const navItems: NavigationMenuItem[][] = [
  [
    { type: 'label', label: 'Smart Inbox' },
    { label: 'Inbox', icon: 'i-lucide-inbox', to: '/inbox' },
    { label: 'Priority', icon: 'i-lucide-star', to: '/priority' },
    { label: 'Requires Reply', icon: 'i-lucide-reply', to: '/inbox?filter=requires-reply' },
    { label: 'Waiting for Reply', icon: 'i-lucide-clock', to: '/inbox?filter=waiting' },
    { label: 'Tasks from Email', icon: 'i-lucide-check-square', to: '/tasks' },
    { label: 'Decisions', icon: 'i-lucide-gavel', to: '/inbox?filter=decisions' },
    { label: 'Meetings', icon: 'i-lucide-calendar', to: '/inbox?filter=meetings' },
    { label: 'Newsletters', icon: 'i-lucide-newspaper', to: '/inbox?filter=newsletters' }
  ],
  [
    { type: 'label', label: 'Mail' },
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
  <UNavigationMenu
    orientation="vertical"
    :items="navItems"
    class="flex-1 px-2 py-4"
  />
</template>
