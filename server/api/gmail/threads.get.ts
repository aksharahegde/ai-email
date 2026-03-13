import type { MailThread, AiTag } from '../../../app/types/mail'
import { getGmailClient, parseEmailAddress, getHeader, extractBody } from '../../utils/gmail'

export default defineEventHandler(async (event) => {
  const gmail = await getGmailClient(event)
  const query = getQuery(event)
  const maxResults = Math.min(Number(query.maxResults) || 50, 50)
  const pageToken = query.pageToken as string | undefined
  const q = (query.q as string) || ''
  const labelIds = query.labelIds
    ? (Array.isArray(query.labelIds) ? query.labelIds : [query.labelIds]).filter(Boolean)
    : undefined

  const res = await gmail.users.threads.list({
    userId: 'me',
    maxResults,
    pageToken,
    q: q || undefined,
    labelIds: labelIds as string[] | undefined
  })

  const threads = res.data.threads ?? []
  const threadIds = threads.map(t => t.id!).filter(Boolean)

  if (threadIds.length === 0) {
    return { threads: [], nextPageToken: res.data.nextPageToken }
  }

  const threadDetails = await Promise.all(
    threadIds.map(id =>
      gmail.users.threads.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date']
      })
    )
  )

  const result: MailThread[] = threadDetails.map((t, i) => {
    const msg = t.data.messages?.[0]
    const headers = msg?.payload?.headers ?? []
    const from = parseEmailAddress(getHeader(headers, 'From'))
    const subject = getHeader(headers, 'Subject') ?? '(No subject)'
    const date = getHeader(headers, 'Date')
    const msgCount = t.data.messages?.length ?? 0

    const lastMsg = t.data.messages?.[msgCount - 1]
    const lastPayload = lastMsg?.payload
    let preview = ''
    if (lastPayload) {
      const body = extractBody(lastPayload)
      preview = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
    }

    const tags: AiTag[] = []
    if (subject.toLowerCase().includes('invoice') || subject.toLowerCase().includes('payment')) {
      tags.push('action-required')
    } else if (subject.toLowerCase().includes('?')) {
      tags.push('question')
    } else if (subject.toLowerCase().includes('meeting') || subject.toLowerCase().includes('sync')) {
      tags.push('meeting')
    } else {
      tags.push('fyi')
    }

    return {
      id: t.data.id!,
      participants: [from],
      subject,
      preview: preview || 'No preview',
      timestamp: date ? new Date(date) : new Date(),
      unread: (msg?.labelIds?.includes('UNREAD') ?? false) || (t.data.messages?.some(m => m.labelIds?.includes('UNREAD')) ?? false),
      tags,
      messageCount: msgCount
    }
  })

  return {
    threads: result,
    nextPageToken: res.data.nextPageToken
  }
})
