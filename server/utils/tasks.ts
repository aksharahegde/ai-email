import { eq, gt, desc } from 'drizzle-orm'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getDb } from '../db'
import { threads, messages, emailTasks } from '../db/schema'
import { getAiModel } from './ai'
import { getSyncState, setSyncState } from './sync'
import type { H3Event } from 'h3'

function now() {
  return Math.floor(Date.now() / 1000)
}

export async function runTaskExtraction(event?: H3Event): Promise<void> {
  await setSyncState('tasks_extracting', '1')

  try {
    const db = getDb()
    const lastExtractedAt = await getSyncState('tasks_last_extracted_at')
    const model = await getAiModel('analysis', event)

    // Process threads synced since last extraction, or all threads on first run
    const threadList = lastExtractedAt
      ? db.select().from(threads)
          .where(gt(threads.syncedAt, Number(lastExtractedAt)))
          .orderBy(desc(threads.lastMessageAt))
          .limit(50)
          .all()
      : db.select().from(threads)
          .orderBy(desc(threads.lastMessageAt))
          .limit(50)
          .all()

    for (const thread of threadList) {
      const firstMsg = db.select().from(messages)
        .where(eq(messages.threadId, thread.id))
        .orderBy(messages.timestamp)
        .limit(1)
        .get()

      if (!firstMsg) continue

      const from = (() => {
        try { return JSON.parse(firstMsg.from) as { name: string, email: string } }
        catch { return { name: '', email: '' } }
      })()

      try {
        const { object } = await generateObject({
          model,
          schema: z.object({
            tasks: z.array(z.object({
              text: z.string(),
              due: z.string().optional().nullable()
            }))
          }),
          prompt: [
            'Extract specific action items and tasks from this email that I need to complete.',
            'Only extract tasks explicitly assigned to me or things I clearly need to do.',
            'Include a due date if mentioned (short string like "Friday", "Jan 15", "Tomorrow").',
            'Return an empty tasks array if there are no clear action items.',
            '',
            `Subject: ${thread.subject}`,
            `From: ${from.name} <${from.email}>`,
            '',
            firstMsg.body.slice(0, 1500)
          ].join('\n')
        })

        for (const task of object.tasks) {
          if (!task.text.trim()) continue
          db.insert(emailTasks).values({
            id: crypto.randomUUID(),
            threadId: thread.id,
            text: task.text.trim(),
            due: task.due ?? null,
            done: 0,
            createdAt: now()
          }).run()
        }
      } catch {
        // Skip thread on AI failure
      }
    }

    await setSyncState('tasks_last_extracted_at', String(now()))
  } finally {
    await setSyncState('tasks_extracting', '0')
  }
}
