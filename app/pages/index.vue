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
  <div class="min-h-screen flex flex-col bg-white">
    <header class="border-b border-neutral-200 px-6 py-4">
      <span class="font-bold tracking-tight text-neutral-900">Neuron Mail</span>
    </header>

    <div class="flex-1 flex items-center justify-center px-4">
      <div class="w-full max-w-md text-center space-y-8">
        <div class="space-y-3">
          <h1 class="text-4xl font-bold tracking-tight text-neutral-900">
            Your inbox,<br>finally intelligent.
          </h1>
          <p class="text-base text-neutral-500">
            Actions, decisions, and context — extracted automatically from every thread.
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
          <p class="text-sm text-neutral-400">
            Sign in with your Google / Gmail account
          </p>
        </div>

        <div
          v-else
          class="space-y-4"
        >
          <p class="text-neutral-600">
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
  </div>
</template>
