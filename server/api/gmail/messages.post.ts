import { getGmailClient } from '../../utils/gmail'

function createMimeMessage(to: string, subject: string, body: string, replyToMessageId?: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    ''
  ]
  if (replyToMessageId) {
    lines.splice(2, 0, `In-Reply-To: ${replyToMessageId}`, `References: ${replyToMessageId}`)
  }
  const bodyHtml = body.replace(/\n/g, '<br>')
  return lines.join('\r\n') + '\r\n' + bodyHtml
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    to: string
    subject: string
    body: string
    threadId?: string
    messageId?: string
  }>(event)

  if (!body?.to || !body?.subject || !body?.body) {
    throw createError({ statusCode: 400, message: 'to, subject, and body are required' })
  }

  const gmail = await getGmailClient(event)
  const raw = createMimeMessage(body.to, body.subject, body.body, body.messageId)
  const encoded = Buffer.from(raw, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encoded,
      threadId: body.threadId
    }
  })

  return { id: res.data.id, threadId: res.data.threadId }
})
