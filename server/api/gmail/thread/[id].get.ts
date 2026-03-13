import type { MailMessage, MailParticipant } from '../../../../app/types/mail'
import { getGmailClient, parseEmailAddress, getHeader, extractBody } from '../../../utils/gmail'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Thread ID required' })
  }

  const gmail = await getGmailClient(event)
  const thread = await gmail.users.threads.get({
    userId: 'me',
    id,
    format: 'full'
  })

  const messages: MailMessage[] = (thread.data.messages ?? []).map((msg, idx) => {
    const headers = msg.payload?.headers ?? []
    const from = parseEmailAddress(getHeader(headers, 'From'))
    const toStr = getHeader(headers, 'To') ?? ''
    const to: MailParticipant[] = toStr.split(',').map(s => parseEmailAddress(s.trim())).filter(p => p.email)
    const subject = getHeader(headers, 'Subject') ?? ''
    const date = getHeader(headers, 'Date')
    const body = extractBody(msg.payload!)

    return {
      id: msg.id!,
      from,
      to,
      subject,
      body: body || '(No content)',
      timestamp: date ? new Date(date) : new Date(),
      isReply: idx > 0
    }
  })

  return {
    id: thread.data.id,
    threadId: thread.data.threadId,
    messages,
    subject: messages[0]?.subject ?? '',
    participants: messages.flatMap(m => [m.from, ...m.to]).filter((p, i, arr) => arr.findIndex(x => x.email === p.email) === i)
  }
})
