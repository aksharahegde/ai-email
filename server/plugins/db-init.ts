import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { smartInboxItems } from '../db/schema'

const DEFAULT_SMART_INBOXES = [
  {
    id: 'default-waiting-for-reply',
    name: 'Waiting for Reply',
    classificationPrompt: 'Did I send this email or reply to it, and I am still waiting for a response from the other person?',
    summarizationPrompt: 'Summarize what I asked or sent and what response I am waiting for.',
    scanScope: 200
  },
  {
    id: 'default-decisions',
    name: 'Decisions',
    classificationPrompt: 'Does this email require me to make a decision, give approval, or choose between options?',
    summarizationPrompt: 'Summarize the decision needed, the options available, and any deadline mentioned.',
    scanScope: 200
  },
  {
    id: 'default-meetings',
    name: 'Meetings',
    classificationPrompt: 'Does this email involve scheduling, confirming, or cancelling a meeting, call, or calendar event?',
    summarizationPrompt: 'Extract the meeting name, date, time, and who is involved.',
    scanScope: 200
  },
  {
    id: 'default-priority',
    name: 'Priority',
    classificationPrompt: 'Is this email urgent, time-sensitive, or from someone important that needs my immediate attention?',
    summarizationPrompt: 'Summarize why this email is urgent and what action is needed.',
    scanScope: 200
  }
]

export default defineNitroPlugin(() => {
  const db = getDb()
  migrate(db, { migrationsFolder: resolve('server/db/migrations') })
  console.log('[db] migrations applied')

  // Remove legacy "Tasks from Email" smart inbox — replaced by the dedicated /tasks page
  db.delete(smartInboxItems).where(eq(smartInboxItems.id, 'default-tasks-from-email')).run()

  const now = Math.floor(Date.now() / 1000)
  for (const item of DEFAULT_SMART_INBOXES) {
    db.insert(smartInboxItems).values({
      ...item,
      classifying: 0,
      classifyTotal: 0,
      classifyDone: 0,
      lastClassifiedAt: null,
      createdAt: now
    }).onConflictDoNothing().run()
  }
  console.log('[db] default smart inboxes seeded')
})
