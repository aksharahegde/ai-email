# Local DB Sync & Dynamic Smart Inbox Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace live Gmail API calls with a local SQLite cache and add user-configurable AI-powered Smart Inbox items with stale-while-revalidate classification.

**Architecture:** SQLite (`.data/email.db`) stores threads, messages, sync state, smart inbox configs, and classification results. A Gmail History API sync engine keeps the local DB current. Smart Inbox items classify locally-cached threads via AI using a background classification loop with a DB-level concurrency lock.

**Tech Stack:** Nuxt 4 · SQLite (`better-sqlite3`) · Drizzle ORM (`drizzle-orm` + `drizzle-kit`) · Vercel AI SDK (`generateObject`, `generateText`) · Gmail History API · `@nuxt/ui` v4

**Spec:** `docs/superpowers/specs/2026-03-13-local-db-and-smart-inbox-design.md`

---

## Chunk 1: Database Foundation

### Task 1: Install dependencies and create DB schema

**Files:**
- Modify: `package.json`
- Create: `server/db/schema.ts`
- Create: `drizzle.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Install packages**

```bash
pnpm add drizzle-orm better-sqlite3
pnpm add -D drizzle-kit @types/better-sqlite3
```

- [ ] **Step 2: Verify installation**

```bash
pnpm list drizzle-orm better-sqlite3 drizzle-kit
```

Expected: all three listed with version numbers.

- [ ] **Step 3: Add `.data/` to `.gitignore`**

If `.gitignore` exists, append:

```
.data/
```

If it doesn't exist, create it with that line.

- [ ] **Step 4: Create `drizzle.config.ts`** at project root

```ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH ?? '.data/email.db'
  }
} satisfies Config
```

- [ ] **Step 5: Create `server/db/schema.ts`**

```ts
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  subject: text('subject').notNull().default(''),
  snippet: text('snippet').notNull().default(''),
  participants: text('participants').notNull().default('[]'), // JSON: { name, email }[]
  unread: integer('unread').notNull().default(0),            // 0 | 1
  messageCount: integer('message_count').notNull().default(0),
  lastMessageAt: integer('last_message_at').notNull().default(0), // unix timestamp
  labels: text('labels').notNull().default('[]'),            // JSON: string[]
  historyId: text('history_id'),
  syncedAt: integer('synced_at').notNull().default(0)        // unix timestamp
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull(),
  from: text('from').notNull().default('{}'),  // JSON: { name, email }
  to: text('to').notNull().default('[]'),      // JSON: { name, email }[]
  cc: text('cc'),                              // JSON: { name, email }[] | null
  subject: text('subject').notNull().default(''),
  body: text('body').notNull().default(''),    // plain text, capped at 10k chars
  timestamp: integer('timestamp').notNull().default(0),
  syncedAt: integer('synced_at').notNull().default(0)
})

export const syncState = sqliteTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

export const smartInboxItems = sqliteTable('smart_inbox_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  classificationPrompt: text('classification_prompt').notNull(),
  summarizationPrompt: text('summarization_prompt'),       // nullable
  scanScope: integer('scan_scope').notNull().default(50),  // 50 | 200 | 500
  classifying: integer('classifying').notNull().default(0), // 0 | 1 (lock flag)
  lastClassifiedAt: integer('last_classified_at'),          // unix timestamp | null
  createdAt: integer('created_at').notNull()
})

export const smartInboxResults = sqliteTable('smart_inbox_results', {
  itemId: text('item_id').notNull(),
  threadId: text('thread_id').notNull(),
  summary: text('summary').notNull(),
  classifiedAt: integer('classified_at').notNull()
}, (table) => [
  primaryKey({ columns: [table.itemId, table.threadId] })
])
```

- [ ] **Step 6: Commit**

```bash
git add server/db/schema.ts drizzle.config.ts package.json pnpm-lock.yaml .gitignore
git commit -m "feat: add drizzle schema and db dependencies"
```

---

### Task 2: Create DB client, migration plugin, and run migrations

**Files:**
- Create: `server/db/index.ts`
- Create: `server/plugins/db-init.ts`

- [ ] **Step 1: Create `server/db/index.ts`**

```ts
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const dbPath = resolve(process.env.DB_PATH ?? '.data/email.db')

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!_db) {
    mkdirSync(dirname(dbPath), { recursive: true })
    const sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    _db = drizzle(sqlite, { schema })
  }
  return _db
}
```

- [ ] **Step 2: Create `server/plugins/db-init.ts`**

This Nitro plugin runs migrations automatically on server start.

```ts
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { resolve } from 'node:path'
import { getDb } from '../db'

export default defineNitroPlugin(() => {
  const db = getDb()
  migrate(db, { migrationsFolder: resolve('server/db/migrations') })
  console.log('[db] migrations applied')
})
```

- [ ] **Step 3: Generate migrations**

```bash
pnpm drizzle-kit generate
```

Expected: `server/db/migrations/` directory created with a SQL migration file (e.g. `0000_initial.sql`).

- [ ] **Step 4: Start the dev server briefly to verify migration runs**

```bash
pnpm dev
```

Expected in console: `[db] migrations applied` and `.data/email.db` file created.

Kill the server after verifying.

- [ ] **Step 5: Commit**

```bash
git add server/db/index.ts server/plugins/db-init.ts server/db/migrations/
git commit -m "feat: add db client and migration plugin"
```

---

## Chunk 2: Gmail Sync Engine

### Task 3: Create sync utility

**Files:**
- Create: `server/utils/sync.ts`

- [ ] **Step 1: Create `server/utils/sync.ts`**

```ts
import { eq, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { threads, messages, syncState } from '../db/schema'
import { getGmailClient, parseEmailAddress, extractBody, getHeader } from './gmail'
import type { H3Event } from 'h3'

export const INITIAL_SYNC_LIMIT = 200

// --- sync_state helpers ---

export async function getSyncState(key: string): Promise<string | null> {
  const db = getDb()
  const rows = db.select().from(syncState).where(eq(syncState.key, key)).all()
  return rows[0]?.value ?? null
}

export async function setSyncState(key: string, value: string): Promise<void> {
  const db = getDb()
  db.insert(syncState).values({ key, value })
    .onConflictDoUpdate({ target: syncState.key, set: { value } })
    .run()
}

// --- thread upsert helper ---

function now() {
  return Math.floor(Date.now() / 1000)
}

async function upsertThreadData(
  db: ReturnType<typeof import('../db').getDb>,
  threadData: Awaited<ReturnType<ReturnType<typeof import('googleapis').google.gmail>['users']['threads']['get']>>['data']
): Promise<void> {
  if (!threadData.id) return

  const msgs = threadData.messages ?? []
  const firstMsg = msgs[0]
  const headers = firstMsg?.payload?.headers ?? []

  const from = parseEmailAddress(getHeader(headers, 'From'))
  const subject = getHeader(headers, 'Subject') ?? '(No subject)'
  const date = getHeader(headers, 'Date')
  const lastMessageAt = date ? Math.floor(new Date(date).getTime() / 1000) : now()

  const allLabels = [...new Set(msgs.flatMap(m => m.labelIds ?? []))]
  const isUnread = allLabels.includes('UNREAD') ? 1 : 0

  const threadRow = {
    id: threadData.id,
    subject,
    snippet: threadData.snippet ?? '',
    participants: JSON.stringify([from]),
    unread: isUnread,
    messageCount: msgs.length,
    lastMessageAt,
    labels: JSON.stringify(allLabels),
    historyId: threadData.historyId ?? null,
    syncedAt: now()
  }

  db.insert(threads).values(threadRow).onConflictDoUpdate({
    target: threads.id,
    set: {
      subject: threadRow.subject,
      snippet: threadRow.snippet,
      participants: threadRow.participants,
      unread: threadRow.unread,
      messageCount: threadRow.messageCount,
      lastMessageAt: threadRow.lastMessageAt,
      labels: threadRow.labels,
      historyId: threadRow.historyId,
      syncedAt: threadRow.syncedAt
    }
  }).run()

  for (const msg of msgs) {
    if (!msg.id) continue
    const mh = msg.payload?.headers ?? []
    const mFrom = parseEmailAddress(getHeader(mh, 'From'))
    const mTo = parseEmailAddress(getHeader(mh, 'To') ?? '')
    const mCc = getHeader(mh, 'Cc')
    const mDate = getHeader(mh, 'Date')
    const mSubject = getHeader(mh, 'Subject') ?? subject

    let body = ''
    if (msg.payload) {
      body = extractBody(msg.payload).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }

    db.insert(messages).values({
      id: msg.id,
      threadId: threadData.id,
      from: JSON.stringify(mFrom),
      to: JSON.stringify([mTo]),
      cc: mCc ? JSON.stringify([parseEmailAddress(mCc)]) : null,
      subject: mSubject,
      body: body.slice(0, 10000),
      timestamp: mDate ? Math.floor(new Date(mDate).getTime() / 1000) : now(),
      syncedAt: now()
    }).onConflictDoUpdate({
      target: messages.id,
      set: { body: body.slice(0, 10000), syncedAt: now() }
    }).run()
  }
}

// --- initial sync ---

export async function runInitialSync(event: H3Event): Promise<number> {
  const gmail = await getGmailClient(event)
  const db = getDb()

  const listRes = await gmail.users.threads.list({
    userId: 'me',
    maxResults: INITIAL_SYNC_LIMIT
  })

  const threadList = listRes.data.threads ?? []
  let count = 0

  for (const t of threadList) {
    if (!t.id) continue
    const full = await gmail.users.threads.get({ userId: 'me', id: t.id, format: 'full' })
    await upsertThreadData(db, full.data)
    count++
  }

  // Save historyId from list response
  if (listRes.data.threads?.[0]) {
    // Get historyId from the first full thread fetch
    const first = await gmail.users.threads.get({ userId: 'me', id: threadList[0].id!, format: 'minimal' })
    if (first.data.historyId) {
      setSyncState('gmail_history_id', first.data.historyId)
    }
  }

  return count
}

// --- incremental sync ---

export async function runIncrementalSync(event: H3Event): Promise<number> {
  const historyId = await getSyncState('gmail_history_id')

  if (!historyId) {
    return runInitialSync(event)
  }

  const gmail = await getGmailClient(event)
  const db = getDb()

  let historyRes
  try {
    historyRes = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
      historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']
    })
  } catch (err: any) {
    if (err?.code === 404 || err?.status === 404) {
      // History expired — full re-sync
      await setSyncState('gmail_history_id', '')
      return runInitialSync(event)
    }
    throw err
  }

  const history = historyRes.data.history ?? []
  const processedThreadIds = new Set<string>()
  const deletedMessageIds = new Set<string>()
  let count = 0

  for (const record of history) {
    // MESSAGES_ADDED
    for (const added of record.messagesAdded ?? []) {
      const threadId = added.message?.threadId
      if (threadId && !processedThreadIds.has(threadId)) {
        processedThreadIds.add(threadId)
        const full = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' })
        await upsertThreadData(db, full.data)
        count++
      }
    }

    // MESSAGES_DELETED
    for (const deleted of record.messagesDeleted ?? []) {
      const msgId = deleted.message?.id
      const threadId = deleted.message?.threadId
      if (msgId) deletedMessageIds.add(msgId)
      if (threadId && !processedThreadIds.has(threadId)) {
        processedThreadIds.add(threadId)
      }
    }

    // LABELS_MODIFIED (labelsAdded + labelsRemoved)
    for (const labelChange of [...(record.labelsAdded ?? []), ...(record.labelsRemoved ?? [])]) {
      const threadId = labelChange.message?.threadId
      if (threadId && !processedThreadIds.has(threadId)) {
        processedThreadIds.add(threadId)
        const full = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' })
        await upsertThreadData(db, full.data)
        count++
      }
    }
  }

  // Delete removed messages and clean up orphaned threads
  for (const msgId of deletedMessageIds) {
    const threadId = db.select({ threadId: messages.threadId })
      .from(messages).where(eq(messages.id, msgId)).get()?.threadId
    db.delete(messages).where(eq(messages.id, msgId)).run()
    if (threadId) {
      const remaining = db.select({ count: sql<number>`count(*)` })
        .from(messages).where(eq(messages.threadId, threadId)).get()
      if ((remaining?.count ?? 0) === 0) {
        db.delete(threads).where(eq(threads.id, threadId)).run()
      }
    }
  }

  // Save new historyId
  if (historyRes.data.historyId) {
    await setSyncState('gmail_history_id', historyRes.data.historyId)
  }

  return count
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm typecheck
```

Fix any type errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add server/utils/sync.ts
git commit -m "feat: add gmail sync utility (initial + incremental)"
```

---

### Task 4: Create sync API routes

**Files:**
- Create: `server/api/sync/gmail.get.ts`
- Create: `server/api/sync/gmail/status.get.ts`

- [ ] **Step 1: Create `server/api/sync/gmail.get.ts`**

```ts
import { runIncrementalSync, setSyncState } from '../../utils/sync'

export default defineEventHandler(async (event) => {
  // Capture credentials before firing background task
  await requireUserSession(event) // throws 401 if not logged in

  // Set syncing flag synchronously before returning
  await setSyncState('gmail_syncing', '1')
  await setSyncState('gmail_new_count', '0')

  // Fire background sync — does not block the response
  setImmediate(async () => {
    try {
      const count = await runIncrementalSync(event)
      await setSyncState('gmail_new_count', String(count))
    } catch (err) {
      console.error('[sync] incremental sync failed:', err)
    } finally {
      await setSyncState('gmail_syncing', '0')
    }
  })

  return { syncing: true }
})
```

- [ ] **Step 2: Create `server/api/sync/gmail/status.get.ts`**

```ts
import { getSyncState } from '../../../utils/sync'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const syncing = await getSyncState('gmail_syncing')
  const newCount = await getSyncState('gmail_new_count')

  return {
    syncing: syncing === '1',
    newCount: Number(newCount ?? 0)
  }
})
```

- [ ] **Step 3: Manual test**

Start dev server (`pnpm dev`), log in, then:

```bash
curl http://localhost:3000/api/sync/gmail
# Expected: {"syncing":true}

# Wait 5 seconds, then:
curl http://localhost:3000/api/sync/gmail/status
# Expected: {"syncing":false,"newCount":N}
```

Check that `.data/email.db` now contains thread rows.

- [ ] **Step 4: Commit**

```bash
git add server/api/sync/
git commit -m "feat: add gmail sync API routes"
```

---

## Chunk 3: Local DB Thread Routes & Type Migration

### Task 5: Create local DB thread routes

**Files:**
- Create: `server/api/threads/index.get.ts`
- Create: `server/api/threads/[id].get.ts`

- [ ] **Step 1: Create `server/api/threads/index.get.ts`**

```ts
import { eq, desc, and, sql } from 'drizzle-orm'
import { getDb } from '../../db'
import { threads } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 200)
  const offset = Number(query.offset) || 0
  const labelFilter = query.label as string | undefined
  const unreadFilter = query.unread === '1' ? 1 : undefined

  const db = getDb()

  const conditions = []

  if (labelFilter) {
    // JSON array contains label string
    conditions.push(sql`json_each.value = ${labelFilter}`)
  }

  if (unreadFilter !== undefined) {
    conditions.push(eq(threads.unread, unreadFilter))
  }

  let rows

  if (labelFilter) {
    // Join with json_each to filter by label
    rows = db.all<typeof threads.$inferSelect>(sql`
      SELECT t.*
      FROM threads t, json_each(t.labels) je
      WHERE je.value = ${labelFilter}
      ${unreadFilter !== undefined ? sql`AND t.unread = ${unreadFilter}` : sql``}
      ORDER BY t.last_message_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `)
  } else {
    rows = await db.select().from(threads)
      .where(unreadFilter !== undefined ? eq(threads.unread, unreadFilter) : undefined)
      .orderBy(desc(threads.lastMessageAt))
      .limit(limit)
      .offset(offset)
  }

  const result = rows.map(t => ({
    id: t.id,
    subject: t.subject,
    snippet: t.snippet,
    participants: JSON.parse(t.participants),
    unread: t.unread === 1,
    messageCount: t.messageCount,
    lastMessageAt: t.lastMessageAt,
    labels: JSON.parse(t.labels),
    syncedAt: t.syncedAt
  }))

  return { threads: result }
})
```

- [ ] **Step 2: Create `server/api/threads/[id].get.ts`**

```ts
import { eq } from 'drizzle-orm'
import { getDb } from '../../db'
import { threads, messages } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Thread ID required' })

  const db = getDb()

  const thread = db.select().from(threads).where(eq(threads.id, id)).get()
  if (!thread) throw createError({ statusCode: 404, message: 'Thread not found' })

  const msgs = await db.select().from(messages)
    .where(eq(messages.threadId, id))
    .orderBy(messages.timestamp)

  return {
    id: thread.id,
    subject: thread.subject,
    participants: JSON.parse(thread.participants),
    messages: msgs.map(m => ({
      id: m.id,
      threadId: m.threadId,
      from: JSON.parse(m.from),
      to: JSON.parse(m.to),
      cc: m.cc ? JSON.parse(m.cc) : undefined,
      subject: m.subject,
      body: m.body,
      timestamp: new Date(m.timestamp * 1000)
    }))
  }
})
```

- [ ] **Step 3: Manual test**

```bash
curl "http://localhost:3000/api/threads?limit=5"
# Expected: { threads: [...] } with rows from local DB

curl "http://localhost:3000/api/threads/THREAD_ID_HERE"
# Expected: thread with messages array
```

- [ ] **Step 4: Commit**

```bash
git add server/api/threads/
git commit -m "feat: add local db thread API routes"
```

---

### Task 6: Type system migration and inbox page update

**Files:**
- Modify: `app/types/mail.ts`
- Modify: `app/composables/useGmail.ts`
- Modify: `app/components/mail/MailListItem.vue`
- Modify: `app/pages/inbox/index.vue`
- Modify: `nuxt.config.ts`

- [ ] **Step 1: Update `app/types/mail.ts`**

Remove `tags` from `MailThread` and rename `preview` → `snippet`:

```ts
export type AiTag = 'action-required' | 'question' | 'decision' | 'meeting' | 'fyi'

export interface MailParticipant {
  email: string
  name: string
  avatar?: string
}

export interface MailThread {
  id: string
  participants: MailParticipant[]
  subject: string
  snippet: string        // was "preview"
  timestamp: Date
  unread: boolean
  messageCount: number
  // tags removed — no longer on threads
}

export interface MailMessage {
  id: string
  from: MailParticipant
  to: MailParticipant[]
  cc?: MailParticipant[]
  subject: string
  body: string
  timestamp: Date
  isReply?: boolean
}

export interface ThreadAnalysis {
  summary: string[]
  actionItems: { text: string, due?: string }[]
  questions: string[]
  decisions: string[]
  people: Array<{
    name: string
    email: string
    company?: string
    lastInteraction?: string
    notes?: string
  }>
}
```

- [ ] **Step 2: Add `useThreads` to `app/composables/useGmail.ts`**

Append to the end of the existing file (keep all existing exports):

```ts
// New: reads from local DB instead of Gmail API directly
export function useThreads(query?: { label?: string, unread?: '1', limit?: number, offset?: number }) {
  const { data, error, refresh, status } = useFetch<{
    threads: Array<{
      id: string
      subject: string
      snippet: string
      participants: { name: string, email: string }[]
      unread: boolean
      messageCount: number
      lastMessageAt: number
      syncedAt: number
    }>
  }>('/api/threads', {
    query: query as Record<string, string | number | undefined>,
    default: () => ({ threads: [] })
  })

  const threads = computed(() =>
    (data.value?.threads ?? []).map(t => ({
      ...t,
      timestamp: new Date(t.lastMessageAt * 1000)
    }))
  )

  return { data, error, refresh, status, threads }
}
```

- [ ] **Step 3: Update `app/components/mail/MailListItem.vue`**

Replace the existing file content:

```vue
<script setup lang="ts">
import type { MailThread } from '~/types/mail'

const props = defineProps<{
  thread: MailThread
  selected?: boolean
  summary?: string  // optional AI summary; renders instead of snippet when provided
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

function formatTime(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const primaryParticipant = computed(() => props.thread.participants[0] ?? { email: '', name: 'Unknown' })
const displaySnippet = computed(() => props.summary ?? props.thread.snippet)
</script>

<template>
  <button
    type="button"
    class="w-full text-left px-4 py-3 hover:bg-neutral-100 transition-colors border-b border-default"
    :class="{ 'bg-neutral-200': selected }"
    data-testid="mail-thread-row"
    @click="emit('select', thread.id)"
  >
    <div class="flex gap-3">
      <UAvatar
        :alt="primaryParticipant.name"
        :src="primaryParticipant.avatar"
        size="sm"
      />
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <span
            class="truncate font-medium"
            :class="{ 'font-semibold': thread.unread }"
          >
            {{ primaryParticipant.name }}
          </span>
          <span class="text-xs text-muted shrink-0">
            {{ formatTime(thread.timestamp) }}
          </span>
        </div>
        <p
          class="truncate text-sm"
          :class="{ 'font-medium': thread.unread }"
        >
          {{ thread.subject }}
        </p>
        <p class="truncate text-sm text-muted">
          {{ displaySnippet }}
        </p>
      </div>
      <div
        v-if="thread.unread"
        class="w-2 h-2 rounded-full bg-neutral-900 shrink-0 mt-2"
      />
    </div>
  </button>
</template>
```

- [ ] **Step 4: Update `app/pages/inbox/index.vue`**

Replace the existing file content:

```vue
<script setup lang="ts">
import type { MailThread } from '~/types/mail'

definePageMeta({ layout: 'dashboard' })

const selectedThreadId = inject<Ref<string | null>>('mail:selectedThread')!
const { threads, status: threadsStatus, refresh } = useThreads({ limit: 50 })

const displayThreads = computed<MailThread[]>(() =>
  threads.value.map(t => ({
    id: t.id,
    subject: t.subject,
    snippet: t.snippet,
    participants: t.participants,
    unread: t.unread,
    messageCount: t.messageCount,
    timestamp: t.timestamp
  }))
)

const selectedThread = computed(() =>
  selectedThreadId?.value
    ? displayThreads.value.find(t => t.id === selectedThreadId.value) ?? null
    : null
)

function onSelectThread(id: string) {
  if (selectedThreadId) {
    selectedThreadId.value = selectedThreadId.value === id ? null : id
  }
}

// --- refresh / sync ---
const syncing = ref(false)
const lastSyncedAt = ref<number | null>(null)

async function triggerRefresh() {
  syncing.value = true
  await $fetch('/api/sync/gmail')

  // Poll until done
  const interval = setInterval(async () => {
    const status = await $fetch<{ syncing: boolean, newCount: number }>('/api/sync/gmail/status')
    if (!status.syncing) {
      clearInterval(interval)
      syncing.value = false
      lastSyncedAt.value = Math.floor(Date.now() / 1000)
      await refresh()
    }
  }, 3000)
}

function formatSyncTime(ts: number | null) {
  if (!ts) return null
  const diff = Math.floor((Date.now() / 1000) - ts)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  return `${Math.floor(diff / 3600)}h ago`
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div
      v-if="!selectedThread"
      class="flex-1 overflow-hidden flex flex-col"
    >
      <MailList
        :threads="displayThreads"
        :selected-id="selectedThreadId ?? null"
        :loading="threadsStatus === 'pending'"
        @select="onSelectThread"
      />
      <div class="px-4 py-2 border-t border-default flex items-center justify-between text-xs text-muted shrink-0">
        <span v-if="lastSyncedAt">Last synced {{ formatSyncTime(lastSyncedAt) }}</span>
        <span v-else>Loaded from local cache</span>
        <button
          class="underline hover:text-foreground transition-colors"
          :disabled="syncing"
          @click="triggerRefresh"
        >
          {{ syncing ? 'Syncing…' : 'Refresh' }}
        </button>
      </div>
    </div>

    <div
      v-else
      class="flex-1 overflow-auto"
    >
      <div class="p-2 border-b border-default">
        <UButton
          variant="ghost"
          size="sm"
          icon="i-lucide-arrow-left"
          @click="selectedThreadId = null"
        >
          Back
        </UButton>
      </div>
      <MailThread
        :thread-id="selectedThread.id"
        :subject="selectedThread.subject"
        :participants="selectedThread.participants"
        :timestamp="selectedThread.timestamp"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 5: Add route rule for smart-inbox in `nuxt.config.ts`**

Add to the `routeRules` object:

```ts
'/smart-inbox/**': { ssr: false }
```

So it becomes:

```ts
routeRules: {
  '/inbox': { ssr: false },
  '/inbox/**': { ssr: false },
  '/priority': { ssr: false },
  '/tasks': { ssr: false },
  '/settings/**': { ssr: false },
  '/smart-inbox/**': { ssr: false }
},
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
pnpm typecheck
```

Fix any errors (typically `thread.preview` references in other files — replace with `thread.snippet`).

- [ ] **Step 7: Manual test**

Open `http://localhost:3000/inbox`. Should load threads from local DB. Click "Refresh" — should trigger sync and reload.

- [ ] **Step 8: Commit**

```bash
git add app/types/mail.ts app/composables/useGmail.ts app/components/mail/MailListItem.vue app/pages/inbox/index.vue nuxt.config.ts
git commit -m "feat: migrate inbox to local db, update MailThread type"
```

---

## Chunk 4: Smart Inbox Backend

### Task 7: Smart Inbox CRUD routes

**Files:**
- Create: `server/api/smart-inbox/index.get.ts`
- Create: `server/api/smart-inbox/index.post.ts`
- Create: `server/api/smart-inbox/[id].put.ts`
- Create: `server/api/smart-inbox/[id].delete.ts`

- [ ] **Step 1: Create `server/api/smart-inbox/index.get.ts`**

```ts
import { desc } from 'drizzle-orm'
import { getDb } from '../../db'
import { smartInboxItems } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const db = getDb()
  const items = await db.select().from(smartInboxItems).orderBy(desc(smartInboxItems.createdAt))
  return { items }
})
```

- [ ] **Step 2: Create `server/api/smart-inbox/index.post.ts`**

```ts
import { getDb } from '../../db'
import { smartInboxItems } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const body = await readBody(event)

  if (!body.name || !body.classificationPrompt) {
    throw createError({ statusCode: 400, message: 'name and classificationPrompt are required' })
  }

  const scanScope = [50, 200, 500].includes(Number(body.scanScope)) ? Number(body.scanScope) : 50

  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  const db = getDb()

  db.insert(smartInboxItems).values({
    id,
    name: String(body.name),
    classificationPrompt: String(body.classificationPrompt),
    summarizationPrompt: body.summarizationPrompt ? String(body.summarizationPrompt) : null,
    scanScope,
    classifying: 0,
    lastClassifiedAt: null,
    createdAt: now
  }).run()

  const item = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()
  return { item }
})
```

Note: add `import { eq } from 'drizzle-orm'` at top.

- [ ] **Step 3: Create `server/api/smart-inbox/[id].put.ts`**

```ts
import { eq } from 'drizzle-orm'
import { getDb } from '../../db'
import { smartInboxItems, smartInboxResults } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const body = await readBody(event)
  const db = getDb()

  const existing = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()
  if (!existing) throw createError({ statusCode: 404, message: 'Smart inbox not found' })

  const scanScope = [50, 200, 500].includes(Number(body.scanScope)) ? Number(body.scanScope) : existing.scanScope

  // Update item
  db.update(smartInboxItems).set({
    name: body.name ? String(body.name) : existing.name,
    classificationPrompt: body.classificationPrompt ? String(body.classificationPrompt) : existing.classificationPrompt,
    summarizationPrompt: body.summarizationPrompt !== undefined
      ? (body.summarizationPrompt ? String(body.summarizationPrompt) : null)
      : existing.summarizationPrompt,
    scanScope,
    lastClassifiedAt: null // invalidate: force re-classification
  }).where(eq(smartInboxItems.id, id)).run()

  // Delete all cached results so re-classification starts fresh
  db.delete(smartInboxResults).where(eq(smartInboxResults.itemId, id)).run()

  const item = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()
  return { item }
})
```

- [ ] **Step 4: Create `server/api/smart-inbox/[id].delete.ts`**

```ts
import { eq } from 'drizzle-orm'
import { getDb } from '../../db'
import { smartInboxItems, smartInboxResults } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const db = getDb()

  db.delete(smartInboxResults).where(eq(smartInboxResults.itemId, id)).run()
  db.delete(smartInboxItems).where(eq(smartInboxItems.id, id)).run()

  return { success: true }
})
```

- [ ] **Step 5: Manual test**

```bash
# Create an item
curl -X POST http://localhost:3000/api/smart-inbox \
  -H 'Content-Type: application/json' \
  -d '{"name":"Invoices","classificationPrompt":"Does this email contain an invoice or payment request?","scanScope":50}'
# Expected: { item: { id: "...", name: "Invoices", ... } }

# List items
curl http://localhost:3000/api/smart-inbox
# Expected: { items: [{ id: "...", name: "Invoices", ... }] }
```

- [ ] **Step 6: Commit**

```bash
git add server/api/smart-inbox/index.get.ts server/api/smart-inbox/index.post.ts server/api/smart-inbox/[id].put.ts server/api/smart-inbox/[id].delete.ts
git commit -m "feat: add smart inbox CRUD API routes"
```

---

### Task 8: Create classification utility

**Files:**
- Create: `server/utils/classify.ts`

- [ ] **Step 1: Create `server/utils/classify.ts`**

```ts
import { eq, desc, gt, and, sql } from 'drizzle-orm'
import { generateObject, generateText } from 'ai'
import { z } from 'zod'
import { getDb } from '../db'
import { threads, messages, smartInboxItems, smartInboxResults } from '../db/schema'
import { getAiModel } from './ai'
import type { H3Event } from 'h3'

function now() {
  return Math.floor(Date.now() / 1000)
}

export function shouldReclassify(item: {
  classifying: number
  lastClassifiedAt: number | null
}): boolean {
  if (item.classifying === 1) return false // already running
  if (!item.lastClassifiedAt) return true  // never classified

  const fifteenMinutesAgo = now() - 15 * 60
  if (item.lastClassifiedAt < fifteenMinutesAgo) return true

  // Check if new threads arrived since last classification
  const db = getDb()
  const newer = db.select({ count: sql<number>`count(*)` })
    .from(threads)
    .where(gt(threads.syncedAt, item.lastClassifiedAt))
    .get()

  return (newer?.count ?? 0) > 0
}

export async function runClassification(itemId: string, event?: H3Event): Promise<void> {
  const db = getDb()

  // Acquire concurrency lock
  db.update(smartInboxItems)
    .set({ classifying: 1 })
    .where(eq(smartInboxItems.id, itemId))
    .run()

  try {
    const item = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, itemId)).get()
    if (!item) return

    const { classificationPrompt, summarizationPrompt, scanScope } = item
    const model = await getAiModel('analysis', event)

    const threadList = await db.select().from(threads)
      .orderBy(desc(threads.lastMessageAt))
      .limit(scanScope)

    for (const thread of threadList) {
      // firstMessage = message with lowest timestamp (original, not a reply)
      const firstMsg = db.select().from(messages)
        .where(eq(messages.threadId, thread.id))
        .orderBy(messages.timestamp)
        .limit(1)
        .get()

      const from = firstMsg ? JSON.parse(firstMsg.from) : { name: '', email: '' }
      const body = firstMsg?.body ?? ''

      const prompt = [
        classificationPrompt,
        '',
        `Subject: ${thread.subject}`,
        `From: ${from.name} <${from.email}>`,
        '',
        body.slice(0, 800)
      ].join('\n')

      let matches = false
      try {
        const result = await generateObject({
          model,
          schema: z.object({ matches: z.boolean() }),
          prompt
        })
        matches = result.object.matches
      } catch {
        // Skip this thread if AI fails
        continue
      }

      if (matches) {
        let summary = thread.snippet

        if (summarizationPrompt) {
          try {
            const { text } = await generateText({
              model,
              prompt: `${summarizationPrompt}\n\nSubject: ${thread.subject}\n\n${body.slice(0, 800)}`
            })
            summary = text.trim()
          } catch {
            // Fall back to snippet
          }
        }

        db.insert(smartInboxResults).values({
          itemId,
          threadId: thread.id,
          summary,
          classifiedAt: now()
        }).onConflictDoUpdate({
          target: [smartInboxResults.itemId, smartInboxResults.threadId],
          set: { summary, classifiedAt: now() }
        }).run()
      } else {
        db.delete(smartInboxResults)
          .where(
            and(
              eq(smartInboxResults.itemId, itemId),
              eq(smartInboxResults.threadId, thread.id)
            )
          )
          .run()
      }
    }
  } finally {
    // Always release lock and update timestamp
    db.update(smartInboxItems)
      .set({ classifying: 0, lastClassifiedAt: now() })
      .where(eq(smartInboxItems.id, itemId))
      .run()
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add server/utils/classify.ts
git commit -m "feat: add smart inbox classification utility"
```

---

### Task 9: Smart Inbox threads endpoint

**Files:**
- Create: `server/api/smart-inbox/[id]/threads.get.ts`

- [ ] **Step 1: Create `server/api/smart-inbox/[id]/threads.get.ts`**

```ts
import { eq } from 'drizzle-orm'
import { getDb } from '../../../db'
import { smartInboxItems, smartInboxResults, threads } from '../../../db/schema'
import { shouldReclassify, runClassification } from '../../../utils/classify'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const db = getDb()

  const item = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()
  if (!item) throw createError({ statusCode: 404, message: 'Smart inbox not found' })

  // Return cached results immediately
  const results = db.select({
    threadId: smartInboxResults.threadId,
    summary: smartInboxResults.summary,
    classifiedAt: smartInboxResults.classifiedAt,
    subject: threads.subject,
    snippet: threads.snippet,
    participants: threads.participants,
    unread: threads.unread,
    lastMessageAt: threads.lastMessageAt
  })
    .from(smartInboxResults)
    .innerJoin(threads, eq(smartInboxResults.threadId, threads.id))
    .where(eq(smartInboxResults.itemId, id))
    .orderBy(threads.lastMessageAt)
    .all()

  // Trigger background re-classification if stale
  const stale = shouldReclassify(item)
  if (stale) {
    setImmediate(async () => {
      try {
        await runClassification(id, event)
      } catch (err) {
        console.error('[classify] failed for', id, err)
      }
    })
  }

  const currentItem = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()

  return {
    threads: results.map(r => ({
      id: r.threadId,
      subject: r.subject,
      snippet: r.snippet,
      participants: JSON.parse(r.participants),
      unread: r.unread === 1,
      lastMessageAt: r.lastMessageAt,
      timestamp: new Date(r.lastMessageAt * 1000),
      summary: r.summary,
      classifiedAt: r.classifiedAt
    })),
    syncing: (currentItem?.classifying ?? 0) === 1,
    lastClassifiedAt: item.lastClassifiedAt
  }
})
```

- [ ] **Step 2: Manual test**

Using the item ID from Task 7:

```bash
curl http://localhost:3000/api/smart-inbox/ITEM_ID/threads
# Expected: { threads: [], syncing: true, lastClassifiedAt: null }
# (first call triggers background classification)

# After 30 seconds (AI classification runs):
curl http://localhost:3000/api/smart-inbox/ITEM_ID/threads
# Expected: { threads: [...matched threads...], syncing: false, lastClassifiedAt: N }
```

- [ ] **Step 3: Commit**

```bash
git add server/api/smart-inbox/[id]/threads.get.ts
git commit -m "feat: add smart inbox threads endpoint with stale-while-revalidate"
```

---

## Chunk 5: Smart Inbox UI

### Task 10: Update MailSidebar with dynamic Smart Inbox section

**Files:**
- Modify: `app/components/MailSidebar.vue`

- [ ] **Step 1: Replace `app/components/MailSidebar.vue`**

```vue
<script setup lang="ts">
const { data, refresh: refreshItems } = useFetch<{
  items: Array<{
    id: string
    name: string
    classifying: number
    lastClassifiedAt: number | null
  }>
}>('/api/smart-inbox', { default: () => ({ items: [] }) })

const smartInboxItems = computed(() => data.value?.items ?? [])

// Modal state
const modalOpen = ref(false)
const editingItem = ref<{ id: string, name: string, classificationPrompt: string, summarizationPrompt?: string, scanScope: number } | null>(null)

function openCreate() {
  editingItem.value = null
  modalOpen.value = true
}

async function openEdit(id: string) {
  // Fetch full item for edit
  const item = await $fetch<{ item: any }>(`/api/smart-inbox/${id}`)
  editingItem.value = item.item
  modalOpen.value = true
}

async function deleteItem(id: string) {
  if (!confirm('Delete this Smart Inbox?')) return
  await $fetch(`/api/smart-inbox/${id}`, { method: 'DELETE' })
  await refreshItems()
}

async function onSaved() {
  modalOpen.value = false
  await refreshItems()
}

const mailNavItems = [
  [
    { type: 'label', label: 'Mail' },
    { label: 'Sent', icon: 'i-lucide-send', to: '/sent' },
    { label: 'Drafts', icon: 'i-lucide-file-edit', to: '/drafts' },
    { label: 'Archive', icon: 'i-lucide-archive', to: '/archive' }
  ],
  [
    { type: 'label', label: 'Labels' },
    { label: 'Work', icon: 'i-lucide-briefcase', to: '/inbox?label=work' },
    { label: 'Personal', icon: 'i-lucide-user', to: '/inbox?label=personal' },
    { label: 'Finance', icon: 'i-lucide-wallet', to: '/inbox?label=finance' },
    { label: 'Travel', icon: 'i-lucide-plane', to: '/inbox?label=travel' }
  ]
]
</script>

<template>
  <div class="flex-1 px-2 py-4 flex flex-col gap-1 overflow-y-auto">
    <!-- Inbox -->
    <div class="px-2 pb-1">
      <span class="text-xs font-semibold text-muted uppercase tracking-wider">Inbox</span>
    </div>
    <UButton
      to="/inbox"
      variant="ghost"
      color="neutral"
      icon="i-lucide-inbox"
      class="w-full justify-start"
    >
      Inbox
    </UButton>

    <!-- Smart Inbox -->
    <div class="mt-3 px-2 pb-1 flex items-center justify-between">
      <span class="text-xs font-semibold text-muted uppercase tracking-wider">Smart Inbox</span>
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Add smart inbox"
        @click="openCreate"
      />
    </div>

    <div
      v-for="item in smartInboxItems"
      :key="item.id"
      class="group relative"
    >
      <UButton
        :to="`/smart-inbox/${item.id}`"
        variant="ghost"
        color="neutral"
        class="w-full justify-start pr-16"
      >
        <template #leading>
          <span class="w-2 h-2 rounded-full bg-primary shrink-0" />
        </template>
        {{ item.name }}
      </UButton>
      <!-- Edit / Delete — visible on hover -->
      <div class="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Edit"
          @click.prevent="openEdit(item.id)"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Delete"
          @click.prevent="deleteItem(item.id)"
        />
      </div>
    </div>

    <!-- Add smart inbox link -->
    <button
      class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors rounded-md"
      @click="openCreate"
    >
      <span class="w-4 h-4 border border-dashed border-muted rounded-full flex items-center justify-center text-xs">+</span>
      Add smart inbox
    </button>

    <!-- Mail + Labels -->
    <div class="mt-3">
      <UNavigationMenu
        orientation="vertical"
        :items="mailNavItems"
      />
    </div>
  </div>

  <!-- Create/Edit Modal -->
  <SmartInboxModal
    v-model:open="modalOpen"
    :item="editingItem"
    @saved="onSaved"
  />
</template>
```

- [ ] **Step 2: Check it renders**

Start dev server and verify Smart Inbox section appears in sidebar with "+" button and "Add smart inbox" link.

- [ ] **Step 3: Commit**

```bash
git add app/components/MailSidebar.vue
git commit -m "feat: update sidebar with dynamic smart inbox section"
```

---

### Task 11: Create SmartInboxModal component

**Files:**
- Create: `app/components/SmartInboxModal.vue`

- [ ] **Step 1: Create `app/components/SmartInboxModal.vue`**

```vue
<script setup lang="ts">
const props = defineProps<{
  open: boolean
  item?: {
    id: string
    name: string
    classificationPrompt: string
    summarizationPrompt?: string | null
    scanScope: number
  } | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const isEdit = computed(() => !!props.item?.id)
const title = computed(() => isEdit.value ? 'Edit Smart Inbox' : 'New Smart Inbox')

const form = reactive({
  name: '',
  classificationPrompt: '',
  summarizationPrompt: '',
  scanScope: 50 as 50 | 200 | 500
})

watch(() => props.open, (open) => {
  if (open) {
    form.name = props.item?.name ?? ''
    form.classificationPrompt = props.item?.classificationPrompt ?? ''
    form.summarizationPrompt = props.item?.summarizationPrompt ?? ''
    form.scanScope = (props.item?.scanScope as 50 | 200 | 500) ?? 50
  }
})

const saving = ref(false)
const error = ref<string | null>(null)

const scopeOptions = [
  { label: '50 emails', value: 50 },
  { label: '200 emails', value: 200 },
  { label: '500 emails', value: 500 }
]

async function save() {
  if (!form.name.trim() || !form.classificationPrompt.trim()) {
    error.value = 'Name and classification prompt are required'
    return
  }

  saving.value = true
  error.value = null

  try {
    const payload = {
      name: form.name.trim(),
      classificationPrompt: form.classificationPrompt.trim(),
      summarizationPrompt: form.summarizationPrompt.trim() || null,
      scanScope: form.scanScope
    }

    if (isEdit.value) {
      await $fetch(`/api/smart-inbox/${props.item!.id}`, { method: 'PUT', body: payload })
    } else {
      await $fetch('/api/smart-inbox', { method: 'POST', body: payload })
    }

    emit('saved')
  } catch (err: any) {
    error.value = err?.data?.message ?? 'Something went wrong'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    description="AI will classify emails into this inbox based on your prompts"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Name" required>
          <UInput
            v-model="form.name"
            placeholder="e.g. Invoices, Needs Reply, Newsletters…"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Classification prompt" required>
          <p class="text-xs text-muted mb-1">
            AI reads each email and uses this to decide if it belongs here.
          </p>
          <UTextarea
            v-model="form.classificationPrompt"
            placeholder="Does this email contain an invoice or payment request?"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Summarization prompt">
          <p class="text-xs text-muted mb-1">
            How AI summarizes each matching email. Optional — falls back to email snippet.
          </p>
          <UTextarea
            v-model="form.summarizationPrompt"
            placeholder="Extract: vendor name, amount due, due date, payment status."
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Scan scope">
          <UButtonGroup class="w-full">
            <UButton
              v-for="opt in scopeOptions"
              :key="opt.value"
              :variant="form.scanScope === opt.value ? 'solid' : 'outline'"
              color="neutral"
              class="flex-1"
              @click="form.scanScope = opt.value as 50 | 200 | 500"
            >
              {{ opt.label }}
            </UButton>
          </UButtonGroup>
        </UFormField>

        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          @click="emit('update:open', false)"
        >
          Cancel
        </UButton>
        <UButton
          :loading="saving"
          @click="save"
        >
          {{ isEdit ? 'Save Changes' : 'Create & Sync' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
```

- [ ] **Step 2: Test create flow**

Open sidebar → click "Add smart inbox" → fill in form → click "Create & Sync". Verify item appears in sidebar.

- [ ] **Step 3: Test edit flow**

Hover over an existing item → click pencil icon → modal opens pre-filled → save changes. Verify sidebar updates.

- [ ] **Step 4: Commit**

```bash
git add app/components/SmartInboxModal.vue
git commit -m "feat: add smart inbox create/edit modal"
```

---

### Task 12: Create Smart Inbox page

**Files:**
- Create: `app/pages/smart-inbox/[id].vue`

- [ ] **Step 1: Create `app/pages/smart-inbox/[id].vue`**

```vue
<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const id = computed(() => route.params.id as string)

const selectedThreadId = inject<Ref<string | null>>('mail:selectedThread')!

// Fetch smart inbox item metadata
const { data: itemData } = useFetch<{ item: { id: string, name: string, classificationPrompt: string, summarizationPrompt: string | null, scanScope: number } }>(
  () => `/api/smart-inbox/${id.value}`,
  { default: () => ({ item: null }) }
)
const item = computed(() => itemData.value?.item)

// Fetch threads (cached results)
const { data: threadsData, refresh } = useFetch<{
  threads: Array<{
    id: string
    subject: string
    snippet: string
    participants: { name: string, email: string }[]
    unread: boolean
    lastMessageAt: number
    timestamp: Date
    summary: string
    classifiedAt: number
  }>
  syncing: boolean
  lastClassifiedAt: number | null
}>(
  () => `/api/smart-inbox/${id.value}/threads`,
  {
    default: () => ({ threads: [], syncing: false, lastClassifiedAt: null }),
    watch: [id]
  }
)

const threads = computed(() =>
  (threadsData.value?.threads ?? []).map(t => ({
    ...t,
    timestamp: new Date(t.lastMessageAt * 1000)
  }))
)
const syncing = computed(() => threadsData.value?.syncing ?? false)
const lastClassifiedAt = computed(() => threadsData.value?.lastClassifiedAt)

// Poll while syncing
let pollInterval: ReturnType<typeof setInterval> | null = null

watch(syncing, (val) => {
  if (val && !pollInterval) {
    pollInterval = setInterval(async () => {
      await refresh()
      if (!threadsData.value?.syncing) {
        clearInterval(pollInterval!)
        pollInterval = null
      }
    }, 5000)
  }
}, { immediate: true })

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

function formatSyncTime(ts: number | null) {
  if (!ts) return null
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  return `${Math.floor(diff / 3600)}h ago`
}

// Edit modal
const editOpen = ref(false)

async function onSaved() {
  editOpen.value = false
  await refresh()
}

// Thread selection
function onSelectThread(threadId: string) {
  if (selectedThreadId) {
    selectedThreadId.value = selectedThreadId.value === threadId ? null : threadId
  }
}

const selectedThread = computed(() =>
  selectedThreadId?.value
    ? threads.value.find(t => t.id === selectedThreadId.value) ?? null
    : null
)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-default flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <h2 class="font-semibold text-sm">{{ item?.name ?? '…' }}</h2>
        <div v-if="syncing" class="flex items-center gap-1 text-xs text-muted">
          <UIcon name="i-lucide-loader-2" class="animate-spin w-3 h-3" />
          Syncing…
        </div>
      </div>
      <UButton
        v-if="item"
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Edit smart inbox"
        @click="editOpen = true"
      />
    </div>

    <!-- Thread list or empty state -->
    <div
      v-if="!selectedThread"
      class="flex-1 overflow-hidden flex flex-col"
    >
      <!-- Syncing empty state (first classification) -->
      <div
        v-if="syncing && threads.length === 0"
        class="flex-1 flex flex-col items-center justify-center gap-3 text-muted"
      >
        <UIcon name="i-lucide-loader-2" class="animate-spin w-6 h-6" />
        <p class="text-sm">Classifying your emails…</p>
      </div>

      <!-- No results after sync -->
      <div
        v-else-if="!syncing && threads.length === 0"
        class="flex-1 flex flex-col items-center justify-center gap-2 text-muted"
      >
        <UIcon name="i-lucide-inbox" class="w-8 h-8 opacity-30" />
        <p class="text-sm">No emails matched your prompt</p>
      </div>

      <!-- Thread list -->
      <div v-else class="flex-1 overflow-y-auto">
        <MailListItem
          v-for="thread in threads"
          :key="thread.id"
          :thread="thread"
          :selected="selectedThreadId === thread.id"
          :summary="thread.summary"
          @select="onSelectThread"
        />
      </div>

      <!-- Footer -->
      <div class="px-4 py-2 border-t border-default flex items-center justify-between text-xs text-muted shrink-0">
        <span>{{ threads.length }} email{{ threads.length !== 1 ? 's' : '' }} matched</span>
        <span v-if="lastClassifiedAt">Last synced {{ formatSyncTime(lastClassifiedAt) }}</span>
      </div>
    </div>

    <!-- Thread detail -->
    <div
      v-else
      class="flex-1 overflow-auto"
    >
      <div class="p-2 border-b border-default">
        <UButton
          variant="ghost"
          size="sm"
          icon="i-lucide-arrow-left"
          @click="selectedThreadId = null"
        >
          Back
        </UButton>
      </div>
      <MailThread
        :thread-id="selectedThread.id"
        :subject="selectedThread.subject"
        :participants="selectedThread.participants"
        :timestamp="selectedThread.timestamp"
      />
    </div>
  </div>

  <!-- Edit modal -->
  <SmartInboxModal
    v-if="item"
    v-model:open="editOpen"
    :item="item"
    @saved="onSaved"
  />
</template>
```

- [ ] **Step 2: Add a GET route for single item** (needed by the page and edit modal)

Create `server/api/smart-inbox/[id].get.ts`:

```ts
import { eq } from 'drizzle-orm'
import { getDb } from '../../db'
import { smartInboxItems } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const db = getDb()
  const item = db.select().from(smartInboxItems).where(eq(smartInboxItems.id, id)).get()
  if (!item) throw createError({ statusCode: 404, message: 'Not found' })

  return { item }
})
```

- [ ] **Step 3: End-to-end test**

1. Open sidebar → click "Add smart inbox" → create "Invoices" with prompt "Does this email contain an invoice or payment request?" → scan scope 50 → "Create & Sync"
2. Sidebar should show "Invoices" item
3. Click "Invoices" → page loads at `/smart-inbox/[id]`
4. Should show spinner + "Syncing…" indicator
5. After 1-2 minutes (AI classification), threads appear with AI summaries
6. Click a thread → detail view opens
7. Click pencil → edit modal opens pre-filled

- [ ] **Step 4: Commit**

```bash
git add app/pages/smart-inbox/ server/api/smart-inbox/[id].get.ts
git commit -m "feat: add smart inbox page with polling and thread list"
```

---

## Chunk 6: Final wiring and cleanup

### Task 13: Verify full flow and fix any issues

- [ ] **Step 1: Run full typecheck**

```bash
pnpm typecheck
```

Fix all errors.

- [ ] **Step 2: Verify inbox page loads from local DB**

Navigate to `/inbox`. Threads should load. Bottom shows "Loaded from local cache". Click "Refresh" — threads reload after sync.

- [ ] **Step 3: Verify smart inbox create → classify → display**

Create a new Smart Inbox item → navigate to it → confirm syncing indicator shows → wait for classification → confirm matched threads appear with AI summaries.

- [ ] **Step 4: Verify edit invalidates and re-classifies**

Open an existing Smart Inbox item → click pencil → change the prompt → save → page should show "Syncing…" and re-run classification with new prompt.

- [ ] **Step 5: Verify delete removes from sidebar and DB**

Hover over a Smart Inbox item → click trash icon → confirm dialog → item removed from sidebar and DB.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: final wiring and typecheck fixes"
```
