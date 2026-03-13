<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})
</script>

<template>
  <div class="p-4 max-w-2xl">
    <h1 class="text-xl font-semibold mb-4">
      Settings
    </h1>
    <div class="space-y-4">
      <UCard>
        <template #header>
          <h2 class="font-medium">
            Account
          </h2>
        </template>
        <p class="text-sm text-muted">
          Manage your account settings
        </p>
        <UButton
          to="/settings/ai"
          variant="outline"
          class="mt-4"
        >
          AI Settings
        </UButton>
      </UCard>
    </div>
  </div>
</template>
