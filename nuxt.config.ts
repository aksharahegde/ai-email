// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@pinia/nuxt',
    '@nuxt/ui',
    '@nuxt/image',
    '@nuxt/scripts',
    '@formkit/auto-animate',
    '@solar-icons/nuxt',
    '@vueuse/nuxt',
    'evlog',
    'nuxt-auth-utils',
    'nuxt-charts'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    oauth: {
      google: {
        clientId: '',
        clientSecret: ''
      }
    },
    ai: {
      provider: process.env.AI_PROVIDER || 'ollama',
      model: process.env.AI_MODEL || 'llama3.2',
      ollamaUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    }
  },

  routeRules: {
    '/inbox': { ssr: false },
    '/inbox/**': { ssr: false },
    '/priority': { ssr: false },
    '/tasks': { ssr: false },
    '/settings/**': { ssr: false }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
