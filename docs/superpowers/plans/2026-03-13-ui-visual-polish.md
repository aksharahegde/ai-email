# UI Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the indigo/slate color scheme with a black & white palette across the Neuron Mail app, keeping soft pastel AI tags as the only color.

**Architecture:** Token-first cascade — two changes to `app.config.ts` automatically update all `@nuxt/ui` components (buttons, nav active states, focus rings). Targeted fixes to 6 additional files address components that hardcode primary color classes rather than inheriting from tokens.

**Tech Stack:** Nuxt 4, @nuxt/ui v4.5.1, Tailwind CSS v4, Vue 3 Composition API

---

## Chunk 1: Color Tokens & CSS

### Task 1: Update design tokens in app.config.ts

**Files:**
- Modify: `app/app.config.ts`

- [ ] **Step 1: Open `app/app.config.ts` and replace the color config**

Current content:
```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'indigo',
      neutral: 'slate'
    }
  }
})
```

New content:
```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'neutral',
      neutral: 'zinc',
      blue: 'blue',
      purple: 'violet'
    }
  }
})
```

**Why each change:**
- `primary: 'neutral'` — makes all `color="primary"` components (buttons, active nav, focus rings) render as black/dark instead of indigo
- `neutral: 'zinc'` — switches the gray scale from cool-blue slate to slightly warmer zinc
- `blue: 'blue'` — registers blue as a named color so `UBadge color="blue"` works (needed for Decision tag)
- `purple: 'violet'` — registers violet as "purple" so `UBadge color="purple"` works (needed for Meeting tag); pure purple has a poor subtle variant, violet looks better

- [ ] **Step 2: Verify dev server picks up the change**

Run: `pnpm dev` (if not already running)

Open the app in browser. Check:
- The "Compose" button in the mail navbar is now black (not indigo)
- The active nav item in the sidebar is a solid black pill (not indigo-tinted)
- No console errors about unrecognized colors

- [ ] **Step 3: Commit**

```bash
git add app/app.config.ts
git commit -m "feat: switch color tokens to neutral/zinc palette"
```

---

### Task 2: Clean up unused green palette from main.css

**Files:**
- Modify: `app/assets/css/main.css`

- [ ] **Step 1: Remove the custom green color scale**

Current content:
```css
@import "tailwindcss";
@import "@nuxt/ui";

@theme static {
  --font-sans: 'Public Sans', sans-serif;

  --color-green-50: #EFFDF5;
  --color-green-100: #D9FBE8;
  --color-green-200: #B3F5D1;
  --color-green-300: #75EDAE;
  --color-green-400: #00DC82;
  --color-green-500: #00C16A;
  --color-green-600: #00A155;
  --color-green-700: #007F45;
  --color-green-800: #016538;
  --color-green-900: #0A5331;
  --color-green-950: #052E16;
}
```

New content:
```css
@import "tailwindcss";
@import "@nuxt/ui";

@theme static {
  --font-sans: 'Public Sans', sans-serif;
}
```

- [ ] **Step 2: Verify no visual change**

The green palette was never used in the app. The page should look identical after this change. Check the browser — no layout shifts, no missing colors.

- [ ] **Step 3: Commit**

```bash
git add app/assets/css/main.css
git commit -m "chore: remove unused green color palette from main.css"
```

---

## Chunk 2: Email List Components

### Task 3: Fix MailListItem selected state and unread dot

**Files:**
- Modify: `app/components/mail/MailListItem.vue`

**Context:** `MailListItem` renders each thread row in the inbox. Two hardcoded `primary` color classes need to be updated:
- Line 32: selected row uses `bg-primary-50` (was indigo tint) — now primary is neutral so this would be `bg-neutral-50`, near-white on white. Change to explicit `bg-neutral-100` for visible selection.
- Line 76: unread indicator dot uses `bg-primary` (was indigo) — now renders as dark gray, which is fine directionally but explicit `bg-neutral-900` is more intentional.

- [ ] **Step 1: Update the selected state class (line 32)**

Find:
```html
:class="{ 'bg-primary-50 dark:bg-primary-950/30': selected }"
```

Replace with:
```html
:class="{ 'bg-neutral-100': selected }"
```

Note: The `dark:` variant is intentionally removed — this app is light mode only.

- [ ] **Step 2: Update the unread dot class (line 76)**

Find:
```html
class="w-2 h-2 rounded-full bg-primary shrink-0 mt-2"
```

Replace with:
```html
class="w-2 h-2 rounded-full bg-neutral-900 shrink-0 mt-2"
```

- [ ] **Step 3: Verify in browser**

Navigate to the inbox. Click a thread row — it should highlight with a soft gray background (not indigo, not white). Unread threads should show a dark/black dot.

- [ ] **Step 4: Commit**

```bash
git add app/components/mail/MailListItem.vue
git commit -m "fix: update MailListItem selected state and unread dot to B&W palette"
```

---

### Task 4: Update AiTag color map and TypeScript type

**Files:**
- Modify: `app/components/mail/AiTag.vue`

**Context:** `AiTag` renders small colored badge labels on thread rows (e.g. "Action Required", "Decision"). Currently `decision` and `meeting` use `color="primary"` which now cascades to gray — losing their visual distinction. They need explicit color values. `blue` and `purple` were registered in `app.config.ts` in Task 1.

The TypeScript type on the `color` field also needs updating — currently it allows only `'error' | 'warning' | 'primary' | 'neutral'`.

- [ ] **Step 1: Replace the tagConfig object and its TypeScript type**

Find the entire `tagConfig` definition (lines 8–14):
```ts
const tagConfig: Record<AiTag, { label: string; color: 'error' | 'warning' | 'primary' | 'neutral' }> = {
  'action-required': { label: 'Action Required', color: 'error' },
  'question': { label: 'Question', color: 'warning' },
  'decision': { label: 'Decision', color: 'primary' },
  'meeting': { label: 'Meeting', color: 'primary' },
  'fyi': { label: 'FYI', color: 'neutral' }
}
```

Replace with:
```ts
const tagConfig: Record<AiTag, { label: string; color: 'error' | 'warning' | 'blue' | 'purple' | 'neutral' }> = {
  'action-required': { label: 'Action Required', color: 'error' },
  'question':        { label: 'Question',         color: 'warning' },
  'decision':        { label: 'Decision',          color: 'blue' },
  'meeting':         { label: 'Meeting',           color: 'purple' },
  'fyi':             { label: 'FYI',               color: 'neutral' }
}
```

- [ ] **Step 2: Verify in browser**

In the inbox, find thread rows with AI tags. Check:
- "Action Required" → soft red background, red text
- "Question" → soft amber background, amber text
- "Decision" → soft blue background, blue text
- "Meeting" → soft violet background, violet text
- "FYI" → soft gray background, gray text

If `blue`/`purple` tags render as gray (not colored), double-check `app.config.ts` has `blue: 'blue'` and `purple: 'violet'` and restart the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/components/mail/AiTag.vue
git commit -m "fix: update AiTag colors - decision=blue, meeting=purple"
```

---

### Task 5: Fix MailCompose AI suggestion card background

**Files:**
- Modify: `app/components/mail/MailCompose.vue`

**Context:** Inside the compose modal, when an AI draft suggestion is shown, it's highlighted with `bg-primary-50`. After the token swap, `bg-primary-50` on `color="primary"=neutral` becomes near-white — invisible against a white card background.

- [ ] **Step 1: Find and update the AI suggestion card background (line 162)**

Find:
```html
class="bg-primary-50 dark:bg-primary-950/30"
```

Replace with:
```html
class="bg-neutral-100"
```

- [ ] **Step 2: Verify in browser**

Open the compose modal (click "Compose"). Click the "AI Draft" button to generate a suggestion. The suggestion card should appear with a visible light gray background (not invisible white).

- [ ] **Step 3: Commit**

```bash
git add app/components/mail/MailCompose.vue
git commit -m "fix: update MailCompose AI suggestion card background to neutral-100"
```

---

## Chunk 3: Supporting Components & Pages

### Task 6: Fix AiSummaryCard sparkle icon color

**Files:**
- Modify: `app/components/ai/AiSummaryCard.vue`

**Context:** The AI summary card rendered inside the thread view uses a sparkle icon with `text-primary` (was indigo). After the token swap it becomes near-black — loses visual distinction from body text. Change to `text-neutral-400` (medium gray) to keep it subtle but distinct.

- [ ] **Step 1: Find and update the sparkle icon class (line 15)**

Find:
```html
<UIcon name="i-lucide-sparkles" class="text-primary" />
```

Replace with:
```html
<UIcon name="i-lucide-sparkles" class="text-neutral-400" />
```

- [ ] **Step 2: Verify in browser**

Open a thread that has an AI summary. The sparkle icon should appear in medium gray — visible but not black.

- [ ] **Step 3: Commit**

```bash
git add app/components/ai/AiSummaryCard.vue
git commit -m "fix: update AiSummaryCard sparkle icon to neutral-400"
```

---

### Task 7: Tighten dashboard wordmark

**Files:**
- Modify: `app/layouts/dashboard.vue`

**Context:** The "Neuron Mail" text in the sidebar header uses `font-semibold`. Adding `font-bold tracking-tight` gives the wordmark a sharper, more intentional look that matches the B&W aesthetic.

- [ ] **Step 1: Update the wordmark span (line 31)**

Find:
```html
<span class="font-semibold text-lg">Neuron Mail</span>
```

Replace with:
```html
<span class="font-bold tracking-tight text-lg">Neuron Mail</span>
```

- [ ] **Step 2: Verify in browser**

The "Neuron Mail" text in the sidebar header should appear slightly bolder and with tighter letter spacing.

- [ ] **Step 3: Commit**

```bash
git add app/layouts/dashboard.vue
git commit -m "style: tighten Neuron Mail wordmark with font-bold tracking-tight"
```

---

### Task 8: Redesign the login page

**Files:**
- Modify: `app/pages/index.vue`

**Context:** The login page (`definePageMeta({ layout: false })`) is a full-screen centered layout on `bg-neutral-50`. The revamp adds a minimal top bar with the wordmark, switches to a white background, and sharpens the copy.

- [ ] **Step 1: Replace the template**

Current template:
```html
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
```

New template:
```html
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
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000` (log out first if already logged in). Check:
- White background (not light gray)
- Thin top bar with "Neuron Mail" wordmark and a bottom border
- Headline "Your inbox, finally intelligent." in large bold text
- "Continue with Google" button is solid black (not indigo)
- `data-testid` attributes on both the form div and the button are preserved

- [ ] **Step 3: Commit**

```bash
git add app/pages/index.vue
git commit -m "feat: redesign login page with B&W palette and top bar"
```

---

## Summary

| Task | File | Change |
|------|------|--------|
| 1 | `app/app.config.ts` | Switch primary→neutral, neutral→zinc, register blue+purple |
| 2 | `app/assets/css/main.css` | Remove unused green palette |
| 3 | `app/components/mail/MailListItem.vue` | Selected bg + unread dot |
| 4 | `app/components/mail/AiTag.vue` | Tag colors + TS type |
| 5 | `app/components/mail/MailCompose.vue` | AI suggestion card bg |
| 6 | `app/components/ai/AiSummaryCard.vue` | Sparkle icon color |
| 7 | `app/layouts/dashboard.vue` | Wordmark classes |
| 8 | `app/pages/index.vue` | Full login page redesign |
