<script setup lang="ts">
definePageMeta({
  layout: false
})

const { loggedIn, user, fetch } = useUserSession()

await fetch()

if (loggedIn.value) {
  await navigateTo('/inbox')
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
    <div class="w-full max-w-md text-center space-y-8">
      <div class="space-y-2">
        <h1 class="text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Neuron Mail
        </h1>
        <p class="text-lg text-neutral-600 dark:text-neutral-400">
          An AI-first email client. See work, actions, and decisions—not just messages.
        </p>
      </div>

      <div
        v-if="!loggedIn"
        class="space-y-4"
        data-testid="login-google-form"
      >
        <UButton
          to="/auth/google"
          external
          size="xl"
          block
          icon="i-simple-icons-google"
          data-testid="login-google-submit"
        >
          Continue with Google
        </UButton>
        <p class="text-sm text-neutral-500 dark:text-neutral-500">
          Sign in to access your Gmail with AI-powered insights
        </p>
      </div>

      <div
        v-else
        class="space-y-4"
      >
        <p class="text-neutral-600 dark:text-neutral-400">
          Welcome back, {{ user?.name }}
        </p>
        <UButton
          to="/inbox"
          size="xl"
          block
          data-testid="login-continue-inbox"
        >
          Go to Inbox
        </UButton>
      </div>
    </div>
  </div>
</template>
