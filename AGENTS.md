## Learned User Preferences

- Never use mock data or fallback stubs; always wire directly to real APIs
- Use `bun run dev` as the primary dev command
- Google-only login; no other auth providers
- AI must be a first-class feature: dedicated settings page, copilot panel, AI tags on threads
- Ollama models should be auto-detected, not manually configured
- When asked to check pending items, audit systematically across all pages and components
- Do not add explanatory code comments unless explicitly asked

## Learned Workspace Facts

- Project is YuktiMail, an AI-first Gmail client built with Nuxt 4, Nuxt UI v4, Tailwind, Pinia, and nuxt-auth-utils
- AI SDK stack: `ai` (Vercel), `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/groq`, `ollama-ai-provider`
- Gmail is accessed via `googleapis` package; emails are sent through Gmail API, not SMTP
- `nuxt-mail` and `nuxt-email-renderer` modules were removed because they crashed dev server without SMTP config and are unnecessary
- Server API routes under `server/api/ai/` must use `../../utils/ai` and `../../utils/gmail` (two levels up), not three
- After dependency changes, run `pnpm dedupe` to prevent duplicate reka-ui versions that cause SSR crash (`null 'ce'` error)
- `app.vue` must wrap `<NuxtPage>` with `<NuxtLayout>` for dashboard layout to apply; pages without a layout need `definePageMeta({ layout: false })`
- The `getHeader` export in `server/utils/gmail.ts` shadows h3's `getHeader`; this is a harmless Nitro warning
- AI settings are persisted via `setUserSession` and read with `getUserSession` from nuxt-auth-utils
- `getAiModel()` in `server/utils/ai.ts` is async because it reads the user session
- Route rules disable SSR for `/inbox`, `/priority`, `/tasks`, `/settings/**`
