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

// --- helpers ---

function now() {
  return Math.floor(Date.now() / 1000)
}

async function upsertThreadData(
  db: ReturnType<typeof import('../db').getDb>,
  threadData: any
): Promise<void> {
  if (!threadData.id) return

  const msgs = threadData.messages ?? []
  const firstMsg = msgs[0]
  const headers = firstMsg?.payload?.headers ?? []

  const from = parseEmailAddress(getHeader(headers, 'From'))
  const subject = getHeader(headers, 'Subject') ?? '(No subject)'
  const date = getHeader(headers, 'Date')
  const lastMessageAt = date ? Math.floor(new Date(date).getTime() / 1000) : now()

  const allLabels = [...new Set(msgs.flatMap((m: any) => m.labelIds ?? []))]
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
      body = extractBody(msg.payload)
    }

    db.insert(messages).values({
      id: msg.id,
      threadId: threadData.id,
      from: JSON.stringify(mFrom),
      to: JSON.stringify([mTo]),
      cc: mCc ? JSON.stringify([parseEmailAddress(mCc)]) : null,
      subject: mSubject,
      body: body.slice(0, 50000),
      timestamp: mDate ? Math.floor(new Date(mDate).getTime() / 1000) : now(),
      syncedAt: now()
    }).onConflictDoUpdate({
      target: messages.id,
      set: { body: body.slice(0, 50000), syncedAt: now() }
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

  let latestHistoryId: string | null = null

  for (const t of threadList) {
    if (!t.id) continue
    const full = await gmail.users.threads.get({ userId: 'me', id: t.id, format: 'full' })
    await upsertThreadData(db, full.data)
    count++
    // Track highest historyId from fetched threads
    const hid = full.data.historyId
    if (hid && (!latestHistoryId || Number(hid) > Number(latestHistoryId))) {
      latestHistoryId = hid
    }
  }

  if (latestHistoryId) {
    await setSyncState('gmail_history_id', latestHistoryId)
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
      const db = getDb()
      db.delete(syncState).where(eq(syncState.key, 'gmail_history_id')).run()
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
    const msgRow = db.select({ threadId: messages.threadId })
      .from(messages).where(eq(messages.id, msgId)).get()
    const threadId = msgRow?.threadId
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
