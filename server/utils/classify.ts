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
  if (item.classifying === 1) return false  // already running
  if (!item.lastClassifiedAt) return true   // never classified

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

    const threadList = db.select().from(threads)
      .orderBy(desc(threads.lastMessageAt))
      .limit(scanScope)
      .all()

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
