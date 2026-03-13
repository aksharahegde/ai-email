# UI Visual Polish — Design Spec

**Date:** 2026-03-13
**Scope:** Visual polish pass — color tokens, email list, tags, sidebar, login page
**Approach:** Token swap + targeted fixes (Option A)

---

## Goals

- Replace the indigo/slate color scheme with a black & white palette matching the reference screenshot
- Keep light mode only (no dark mode)
- Preserve semantic color on AI tags (soft pastels — the only color in the UI)
- Minimal code changes — cascade as much as possible from token changes

## Out of Scope

- AI Copilot panel redesign (next phase) — note: `CopilotSummary.vue` uses `text-primary` for bullet points; this will cascade to dark gray (acceptable, deferred)
- Thread view / MailMessage redesign (next phase)
- Dark mode support
- New features or data changes

---

## Section 1: Color Tokens

### app.config.ts

```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'neutral',  // was: 'indigo'
      neutral: 'zinc',     // was: 'slate'
      blue: 'blue',        // required for AiTag decision color
      purple: 'violet'     // required for AiTag meeting color
    }
  }
})
```

**Why zinc over slate:** Zinc has slightly warmer undertones than slate, which softens the gray surfaces. Note: switching from `slate` to `zinc` shifts all `neutral-*` classes sitewide (e.g. `text-neutral-600`, `bg-neutral-100`) to zinc shades — a subtle warmth change, intentional.

**Why register blue and purple:** `@nuxt/ui` v4 `UBadge` only accepts color values registered in `app.config.ts`. Unregistered values silently fall back to primary. `blue` maps to Tailwind's `blue` scale; `purple` maps to `violet` (which has a better pastel subtle variant than pure purple).

**Cascade effect** — the primary/neutral swap automatically updates across all `@nuxt/ui` components with no further code changes:
- Primary buttons → black
- Focus rings → black
- `UNavigationMenu` active item → solid black pill with white text
- Compose button (`color="primary"`) → renders as solid black — intended

### main.css

Remove the unused custom green color palette (`--color-green-*`). It was added from a Nuxt template and never referenced in the app. Keep the Public Sans font definition.

---

## Section 2: Email List & Tags

### MailListItem.vue — 2 line changes

**Selected row background:**
```diff
- :class="{ 'bg-primary-50 dark:bg-primary-950/30': selected }"
+ :class="{ 'bg-neutral-100': selected }"
```

**Unread dot:**
```diff
- class="w-2 h-2 rounded-full bg-primary shrink-0 mt-2"
+ class="w-2 h-2 rounded-full bg-neutral-900 shrink-0 mt-2"
```

### AiTag.vue — update tag color map + TypeScript type

Switch `decision` and `meeting` from `color="primary"` to explicit semantic colors. `blue` and `purple` are registered in `app.config.ts` (Section 1). All tags use `variant="subtle"` (soft background + colored text).

```ts
const tagConfig: Record<AiTag, { label: string; color: 'error' | 'warning' | 'blue' | 'purple' | 'neutral' }> = {
  'action-required': { label: 'Action Required', color: 'error' },
  'question':        { label: 'Question',         color: 'warning' },
  'decision':        { label: 'Decision',          color: 'blue' },
  'meeting':         { label: 'Meeting',           color: 'purple' },
  'fyi':             { label: 'FYI',               color: 'neutral' }
}
```

| Tag | Color | Visual result |
|-----|-------|---------------|
| `action-required` | `error` (red) | Soft red bg, red text |
| `question` | `warning` (amber) | Soft amber bg, amber text |
| `decision` | `blue` | Soft blue bg, blue text |
| `meeting` | `purple` (→ violet) | Soft violet bg, violet text |
| `fyi` | `neutral` | Light gray bg, gray text |

### MailCompose.vue — 1 line change

The AI draft suggestion card uses `bg-primary-50` as its highlight background. After the token swap, this becomes near-white on a white card — invisible.

```diff
- class="bg-primary-50 dark:bg-primary-950/30"
+ class="bg-neutral-100"
```

### AiSummaryCard.vue — 1 line change

The sparkle icon in the thread summary card uses `text-primary`. After the swap it becomes dark gray — loses its visual distinction.

```diff
- <UIcon name="i-lucide-sparkles" class="text-primary" />
+ <UIcon name="i-lucide-sparkles" class="text-neutral-400" />
```

---

## Section 3: Sidebar & Layout

### dashboard.vue — 1 line change

Tighten the "Neuron Mail" wordmark in the sidebar header:
```diff
- <span class="font-semibold text-lg">Neuron Mail</span>
+ <span class="font-bold tracking-tight text-lg">Neuron Mail</span>
```

### MailSidebar.vue — no changes needed

`UNavigationMenu` picks up the active state styling from the `primary: 'neutral'` token automatically. The active item renders as a solid black pill with white text.

---

## Section 4: Login Page

### pages/index.vue

Four changes:

1. **Background:** `bg-neutral-50 dark:bg-neutral-950` → `bg-white`

2. **Add top bar:** Replace the current `layout: false` centered layout with a structure that includes a fixed top navigation bar containing the wordmark, plus a centered content area below it:
   ```html
   <div class="min-h-screen flex flex-col bg-white">
     <!-- Top bar -->
     <header class="border-b border-neutral-200 px-6 py-4">
       <span class="font-bold tracking-tight text-neutral-900">Neuron Mail</span>
     </header>
     <!-- Centered content -->
     <div class="flex-1 flex items-center justify-center px-4">
       <!-- existing card content -->
     </div>
   </div>
   ```

3. **Headline copy:** Update tagline:
   - Heading: `"Your inbox, finally intelligent."`
   - Subtext: `"Actions, decisions, and context — extracted automatically from every thread."`

4. **Button:** No change — goes black from token cascade automatically.

---

## Files Changed

| File | Change type | Lines affected |
|------|-------------|----------------|
| `app/app.config.ts` | Token swap + color registration | 4 |
| `app/assets/css/main.css` | Remove unused green palette | ~15 deleted |
| `app/components/mail/MailListItem.vue` | Selected state + unread dot | 2 |
| `app/components/mail/AiTag.vue` | Tag color map + TS type | ~6 |
| `app/components/mail/MailCompose.vue` | AI suggestion card background | 1 |
| `app/components/ai/AiSummaryCard.vue` | Sparkle icon color | 1 |
| `app/layouts/dashboard.vue` | Wordmark class | 1 |
| `app/pages/index.vue` | Background + top bar + copy | ~20 |

**Total: 8 files, ~50 lines changed.**

---

## Design Decisions

- **Light only:** One polished mode is better than two mediocre ones. Dark mode can be added later as a distinct feature.
- **Tags keep color:** They are the only color in the UI. Their semantic meaning (red = urgent, yellow = question) is a useful scan signal.
- **Token-first:** Maximizing cascade from token changes minimizes risk of regressions in untouched components.
- **AppLogo.vue / TemplateMenu.vue:** Both are unused components (not referenced anywhere in the app). No changes needed.
- **CopilotSummary.vue `text-primary` bullets:** Will cascade to dark gray — visually acceptable. Deferred to the AI Copilot panel redesign phase.
