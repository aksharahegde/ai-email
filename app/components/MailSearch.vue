<script setup lang="ts">
const searchQuery = ref('')
</script>

<template>
  <UInput
    v-model="searchQuery"
    icon="i-lucide-search"
    placeholder="Search emails..."
    class="min-w-64"
    data-testid="mail-search-input"
  />
</template>
