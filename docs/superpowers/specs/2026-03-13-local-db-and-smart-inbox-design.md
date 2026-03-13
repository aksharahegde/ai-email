# Local DB Sync & Dynamic Smart Inbox Design

## Goal

Replace live Gmail API calls with a local SQLite cache so the app loads instantly from disk. Build a Dynamic Smart Inbox system on top: users create named inboxes with AI classification and summarization prompts; threads are classified against them in the background using stale-while-revalidate.

## Architecture Overview

Two layers:

1. **Gmail Sync Engine** — mirrors Gmail threads and messages into local SQLite using the Gmail History API for incremental updates. Regular Inbox reads from this cache.
2. **Smart Inbox** — user-defined AI-powered inboxes stored in SQLite. Each inbox has classification and summarization prompts. Classification runs against locally cached threads (no Gmail API needed). Results are cached and refreshed in the background when stale.

**Tech stack:** Nuxt 4 · SQLite (`better-sqlite3`) · Drizzle ORM (`drizzle-orm` + `drizzle-kit`) · Vercel AI SDK · Gmail History API

**SQLite file location:** `.data/email.db` (relative to project root). In dev this lives in the repo root; the path is configured via a `DB_PATH` environment variable with `.data/email.db` as default.

---

## Database Schema

### `threads`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Gmail thread ID |
| `subject` | TEXT | |
| `snippet` | TEXT | Preview line shown in list |
| `participants` | TEXT | JSON array of `{ name, email }` |
| `unread` | INTEGER | Boolean (0/1) |
| `messageCount` | INTEGER | |
| `lastMessageAt` | INTEGER | Unix timestamp |
| `labels` | TEXT | JSON array of Gmail label IDs |
| `historyId` | TEXT | Latest history ID for this thread |
| `syncedAt` | INTEGER | Unix timestamp of last local sync |

### `messages`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Gmail message ID |
| `threadId` | TEXT | FK → `threads.id` |
| `from` | TEXT | JSON `{ name, email }` |
| `to` | TEXT | JSON array |
| `cc` | TEXT | JSON array (nullable) |
| `subject` | TEXT | |
| `body` | TEXT | Plain text body |
| `timestamp` | INTEGER | Unix timestamp |
| `syncedAt` | INTEGER | |

### `sync_state`

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | e.g. `"gmail_history_id"` |
| `value` | TEXT | |

### `smart_inbox_items`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT | Displayed in sidebar |
| `classificationPrompt` | TEXT | Yes/no question sent to AI per thread |
| `summarizationPrompt` | TEXT | Nullable; how to summarize matching threads |
| `scanScope` | INTEGER | 50, 200, or 500 threads |
| `classifying` | INTEGER | Boolean (0/1); lock flag preventing concurrent classification |
| `lastClassifiedAt` | INTEGER | Unix timestamp of last completed classification run; NULL if never |
| `createdAt` | INTEGER | Unix timestamp |

### `smart_inbox_results`

| Column | Type | Notes |
|---|---|---|
| `itemId` | TEXT | FK → `smart_inbox_items.id` |
| `threadId` | TEXT | FK → `threads.id` |
| `summary` | TEXT | AI-generated per-thread summary |
| `classifiedAt` | INTEGER | Unix timestamp |

Primary key: `(itemId, threadId)`

---

## Gmail Sync Engine

### Initial sync (first run)

Triggered when `sync_state` has no `gmail_history_id`.

1. Fetch the last `INITIAL_SYNC_LIMIT` (= 200, defined as a constant) threads via `gmail.users.threads.list`
2. For each thread, fetch full messages via `gmail.users.threads.get`
3. Upsert all threads and messages into local DB
4. Store the latest `historyId` from the thread list response in `sync_state`

### Incremental sync (subsequent runs)

Triggered on app load (server-side, once per session) and on manual refresh.

1. Read `gmail_history_id` from `sync_state`
2. Call `gmail.users.history.list({ startHistoryId: savedId })`
3. For each history record, process event types:
   - **`MESSAGES_ADDED`**: each entry contains `{ message: { id, threadId } }`. Use `threadId` to fetch the full thread via `gmail.users.threads.get(threadId)` and upsert the thread + all its messages.
   - **`MESSAGES_DELETED`**: delete the message from the `messages` table. If the thread has no remaining messages in the DB, delete it too.
   - **`LABELS_MODIFIED`**: use the `message.threadId` from the event to re-fetch the full thread via `gmail.users.threads.get(threadId)` and upsert it. This is the simplest correct way to derive the thread-level `unread` and `labels` values (derived from the union of all message labels in the thread).
4. Update `gmail_history_id` in `sync_state` to the `historyId` from the history response

### History expiry fallback

If `gmail.users.history.list` returns HTTP 404 (history ID expired), delete `gmail_history_id` from `sync_state` and fall back to a full re-sync (same as initial sync).

### Manual refresh endpoint

`GET /api/sync/gmail` fires the incremental sync **asynchronously** (non-blocking — returns immediately while sync runs in background). Returns `{ syncing: true }`.

Sync state is persisted in the `sync_state` table using two keys:
- `gmail_syncing` — `"1"` while sync is running, `"0"` when complete
- `gmail_new_count` — number of threads added or updated in the current/last sync run (reset to `"0"` at the start of each sync)

`GET /api/sync/gmail/status` reads these two keys from `sync_state` and returns `{ syncing: boolean, newCount: number }`. `newCount` counts threads upserted (added or updated) in the most recent sync run. When `syncing: false`, the inbox client should refetch threads.

---

## API Routes

### Sync

| Method | Path | Description |
|---|---|---|
| GET | `/api/sync/gmail` | Fire incremental Gmail sync in background; returns `{ syncing: true }` |
| GET | `/api/sync/gmail/status` | Returns `{ syncing: boolean, newCount: number }` |

### Threads (serve from local DB)

| Method | Path | Description |
|---|---|---|
| GET | `/api/threads` | List threads from local DB. Supports `?label=`, `?unread=1`, `?limit=50` (default), `?offset=0` |
| GET | `/api/threads/[id]` | Get thread + messages from local DB |

Full-text search via `?q=` is **out of scope** for this iteration. The `?q=` parameter is not implemented on the local DB route.

### Smart Inbox

| Method | Path | Description |
|---|---|---|
| GET | `/api/smart-inbox` | List all smart inbox items |
| POST | `/api/smart-inbox` | Create item; triggers initial classification in background |
| PUT | `/api/smart-inbox/[id]` | Update item; deletes all cached results and triggers re-classification |
| DELETE | `/api/smart-inbox/[id]` | Delete item + all its results |
| GET | `/api/smart-inbox/[id]/threads` | Return cached results; trigger background re-classification if stale |

**`GET /api/smart-inbox/[id]/threads` response shape:**

```ts
{
  threads: Array<{
    id: string          // thread ID
    subject: string
    snippet: string
    participants: { name: string, email: string }[]
    unread: boolean
    lastMessageAt: number
    summary: string     // from smart_inbox_results.summary
    classifiedAt: number
  }>,
  syncing: boolean,     // true if background classification is currently running
  lastClassifiedAt: number | null
}
```

---

## Smart Inbox Classification

### Staleness check

When `GET /api/smart-inbox/[id]/threads` is called, trigger a background re-classification if **any** of these are true:

- `smart_inbox_items.lastClassifiedAt` is NULL (never classified)
- `lastClassifiedAt` is more than 15 minutes ago
- The DB contains threads with `syncedAt > lastClassifiedAt` (new threads arrived since last classification)

### Concurrency guard

Before starting a classification job, check `smart_inbox_items.classifying`. If `1`, skip (a job is already running). If `0`, set to `1` (acquire lock), run classification, then set back to `0` and update `lastClassifiedAt` (release lock). Use a `try/finally` to ensure the lock is always released even on error.

### Classification logic (per thread)

For each of the most recent `scanScope` threads from local DB (ordered by `lastMessageAt DESC`):

`firstMessage` is the message in the thread with the lowest `timestamp` value (the original message in the thread, not a reply).

1. Build prompt:
   ```
   ${classificationPrompt}

   Subject: ${thread.subject}
   From: ${firstMessage.from.name} <${firstMessage.from.email}>

   ${firstMessage.body.slice(0, 800)}
   ```
2. Call AI with `generateObject` and schema `{ matches: z.boolean() }`
3. If `matches === true`:
   - If `summarizationPrompt` set: call AI with `generateText` to produce a one-line summary string
   - If not set: use `thread.snippet` as the summary
   - Upsert into `smart_inbox_results`
4. If `matches === false`: delete any existing result for `(itemId, threadId)`
5. After all threads processed: update `smart_inbox_items.lastClassifiedAt`, set `classifying = 0`

### Client polling

While `syncing: true` in the response, client polls `GET /api/smart-inbox/[id]/threads` every 5 seconds. Stops polling when `syncing: false`. The final response where `syncing: false` reflects the complete, finished result set (the lock is released only after all threads are processed and `lastClassifiedAt` is written), so the client can safely replace its displayed list with that response's `threads` array.

---

## Type System

The existing `MailThread` type in `app/types/mail.ts` is updated:

```ts
// BEFORE
interface MailThread {
  id: string
  participants: MailParticipant[]
  subject: string
  preview: string       // renamed → snippet
  timestamp: Date
  unread: boolean
  tags: AiTag[]         // removed (no longer on threads)
  messageCount: number
}

// AFTER
interface MailThread {
  id: string
  participants: MailParticipant[]
  subject: string
  snippet: string       // was "preview"
  timestamp: Date
  unread: boolean
  messageCount: number
}
```

`AiTag` type and the `tags` field are removed from `MailThread`. The `AiTag` type itself is kept (still used on `MailMessage` or future per-message features). All components referencing `thread.preview` are updated to `thread.snippet`. The `tags` prop on `MailListItem.vue` is removed and the AI tag badges in the thread list are removed — they were based on hardcoded pattern-matching anyway.

---

## UI

### `nuxt.config.ts`

Add route rules for the new Smart Inbox pages:

```ts
routeRules: {
  '/smart-inbox/**': { ssr: false }
}
```

### Sidebar (`MailSidebar.vue`)

- **Inbox** section (single item): links to `/inbox`; no AI tags
- **Smart Inbox** section (dynamic): fetched from `GET /api/smart-inbox`
  - Each item shows: colored dot · name · unread count badge
  - Links to `/smart-inbox/[id]`
  - Hover reveals `i-lucide-pencil` (edit) and `i-lucide-trash-2` (delete) icon buttons
  - "Add smart inbox" item with dashed style at the bottom of the section (opens create modal)
  - `i-lucide-plus` button next to the section heading also opens create modal

### Smart Inbox config modal (`SmartInboxModal.vue`)

Fields:
- **Name** — `UInput`; required
- **Classification prompt** — `UTextarea`; required; placeholder: "Does this email contain an invoice or payment request?"
- **Summarization prompt** — `UTextarea`; optional; placeholder: "Extract: vendor name, amount due, due date, payment status"
- **Scan scope** — segmented control (`UButtonGroup`): 50 / 200 / 500

Actions: Cancel · "Create & Sync" (create) / "Save Changes" (edit)

On create: `POST /api/smart-inbox` → close modal → sidebar updates → navigate to `/smart-inbox/[newId]`
On edit: `PUT /api/smart-inbox/[id]` → closes modal → results invalidated → re-classification triggered

### Inbox page (`/inbox`)

- Thread list reads from `GET /api/threads` (local DB), not from `useGmailThreads`
- A new composable `useThreads` (see File Structure) wraps `GET /api/threads`
- No AI tag badges shown in the list
- Footer bar: "Last synced N minutes ago · Refresh" — clicking Refresh calls `GET /api/sync/gmail`, then polls `/api/sync/gmail/status` until `syncing: false`, then refetches threads

### Smart Inbox page (`/smart-inbox/[id].vue`)

- Header: item name + `i-lucide-loader-2` spinner / "Syncing…" text (visible while `syncing: true`) + `i-lucide-pencil` edit button
- Thread list: each row shows `thread.subject`, `thread.participants`, `thread.lastMessageAt`, and the AI `summary` line (replacing the raw snippet). Uses the existing `MailListItem` component with a new optional `summary` prop; when provided, it renders in place of `snippet`.
- Footer: "N emails matched · Last synced X min ago"
- Empty state while syncing (never classified): spinner + "Classifying your emails…"
- Empty state after sync with no results: "No emails matched your prompt"
- **Aggregate summary card is deferred** — not in this iteration

---

## File Structure

### New files

```
server/
  db/
    index.ts                      — Drizzle client (better-sqlite3 driver, not @drizzle-team/nuxt)
    schema.ts                     — All table definitions (threads, messages, sync_state, smart_inbox_items, smart_inbox_results)
    migrations/                   — Generated by drizzle-kit
  api/
    sync/
      gmail.get.ts                — Fire incremental sync in background; return { syncing: true }
      gmail/
        status.get.ts             — Return { syncing: boolean, newCount: number }
    threads/
      index.get.ts                — List threads from local DB (?label, ?unread, ?limit, ?offset)
      [id].get.ts                 — Get thread + messages from local DB
    smart-inbox/
      index.get.ts                — List smart inbox items
      index.post.ts               — Create smart inbox item
      [id].put.ts                 — Update item; delete results; trigger re-classification
      [id].delete.ts              — Delete item + results
      [id]/
        threads.get.ts            — Get results + trigger background classification if stale
  utils/
    sync.ts                       — Gmail sync logic (initial + incremental)
    classify.ts                   — Smart inbox classification logic (staleness check, lock, per-thread AI calls)

app/
  composables/
    useThreads.ts                 — Wraps GET /api/threads; replaces useGmailThreads for inbox
  pages/
    smart-inbox/
      [id].vue                    — Smart inbox page
  components/
    SmartInboxModal.vue           — Create/edit modal
```

### Modified files

```
app/types/mail.ts                 — Remove tags from MailThread; rename preview → snippet
app/pages/inbox/index.vue         — Switch from useGmailThreads to useThreads
app/components/mail/MailSidebar.vue — Dynamic Smart Inbox section
app/components/mail/MailListItem.vue — Remove tags prop; rename preview → snippet; add optional summary prop (renders instead of snippet when provided)
nuxt.config.ts                    — Add routeRules for /smart-inbox/**
package.json                      — Add: drizzle-orm, better-sqlite3 · devDeps: drizzle-kit, @types/better-sqlite3
```

**Note:** `better-sqlite3` is used directly with `drizzle-orm` (no Nuxt module wrapper). The Drizzle client is instantiated in a Nitro plugin or imported directly in server utils.

---

## Out of Scope

- Push notifications / Gmail webhooks (Pub/Sub)
- Multi-user support
- Deleting/archiving emails from the app
- Full-text search (`?q=`) on local DB threads — deferred to a future iteration
- Aggregate summary card on Smart Inbox page — deferred to a future iteration
- Electron `userData` path handling — `.data/email.db` is used for web/dev context only
