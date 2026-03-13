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

- AI Copilot panel redesign (next phase)
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
      neutral: 'zinc'      // was: 'slate'
    }
  }
})
```

**Why zinc over slate:** Zinc has slightly warmer undertones than slate, which softens the gray surfaces and feels less "corporate cool."

**Cascade effect** — these two changes automatically update across all `@nuxt/ui` components:
- Primary buttons → black (`bg-neutral-900`)
- Ghost/outline buttons → zinc borders
- Focus rings → black
- Selected/active component states → zinc tints
- Badge `color="primary"` → zinc gray

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

### AiTag.vue (MailAiTag) — update tag color map

Switch `decision` and `meeting` from `color="primary"` (now gray) to explicit semantic colors. All tags use `variant="subtle"` (soft background + colored text).

| Tag | Color | Rationale |
|-----|-------|-----------|
| `action-required` | `error` (red) | Urgency — unchanged |
| `question` | `warning` (amber) | Attention — unchanged |
| `decision` | `blue` | Informational — explicit instead of primary alias |
| `meeting` | `purple` | Distinct from decision |
| `fyi` | `neutral` | Low priority — unchanged |

```ts
const tagConfig: Record<AiTag, { label: string; color: string }> = {
  'action-required': { label: 'Action Required', color: 'error' },
  'question':        { label: 'Question',         color: 'warning' },
  'decision':        { label: 'Decision',          color: 'blue' },
  'meeting':         { label: 'Meeting',           color: 'purple' },
  'fyi':             { label: 'FYI',               color: 'neutral' }
}
```

---

## Section 3: Sidebar & Layout

### dashboard.vue — 1 line change

Tighten the "Neuron Mail" wordmark in the sidebar header:
```diff
- <span class="font-semibold text-lg">Neuron Mail</span>
+ <span class="font-bold tracking-tight text-lg">Neuron Mail</span>
```

The Compose button (`color="primary"`) requires no change — it renders black automatically from the token update.

### MailSidebar.vue — no changes needed

`UNavigationMenu` picks up the active state styling from the `primary: 'neutral'` token. The active item renders as a solid black pill with white text automatically.

---

## Section 4: Login Page

### pages/index.vue

Four changes:

1. **Background:** `bg-neutral-50 dark:bg-neutral-950` → `bg-white`
2. **Add top bar:** Minimal header with wordmark (`font-bold tracking-tight`) above the centered content, separated by a bottom border
3. **Headline copy:** Replace tagline with: `"Your inbox, finally intelligent."` / subtext: `"Actions, decisions, and context — extracted automatically from every thread."`
4. **Button:** No change needed — goes black from token cascade

---

## Files Changed

| File | Change type | Lines affected |
|------|-------------|----------------|
| `app/app.config.ts` | Token swap | 2 |
| `app/assets/css/main.css` | Remove unused green palette | ~15 deleted |
| `app/components/mail/MailListItem.vue` | Selected state + unread dot | 2 |
| `app/components/mail/AiTag.vue` | Tag color map | 4 |
| `app/layouts/dashboard.vue` | Wordmark class | 1 |
| `app/pages/index.vue` | Background + top bar + copy | ~15 |

**Total: ~6 files, ~25 lines changed.**

---

## Design Decisions

- **Light only:** One polished mode is better than two mediocre ones. Dark mode can be added later as a distinct feature.
- **Tags keep color:** They are the only color in the UI. Their semantic meaning (red = urgent, yellow = question) is a useful scan signal. Removing color would slow comprehension.
- **Token-first:** Maximizing cascade from token changes minimizes risk of regressions in untouched components.
