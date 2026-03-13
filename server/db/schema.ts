import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core'

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
  threadId: text('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  from: text('from').notNull().default('{}'),  // JSON: { name, email }
  to: text('to').notNull().default('[]'),      // JSON: { name, email }[]
  cc: text('cc'),                              // JSON: { name, email }[] | null
  subject: text('subject').notNull().default(''),
  body: text('body').notNull().default(''),    // plain text, capped at 10k chars
  timestamp: integer('timestamp').notNull().default(0),
  syncedAt: integer('synced_at').notNull().default(0)
}, (table) => [
  index('messages_thread_id_idx').on(table.threadId)
])

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
  createdAt: integer('created_at').notNull().default(0)
})

export const smartInboxResults = sqliteTable('smart_inbox_results', {
  itemId: text('item_id').notNull().references(() => smartInboxItems.id, { onDelete: 'cascade' }),
  threadId: text('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  classifiedAt: integer('classified_at').notNull()
}, (table) => [
  primaryKey({ columns: [table.itemId, table.threadId] }),
  index('smart_inbox_results_item_id_idx').on(table.itemId)
])
