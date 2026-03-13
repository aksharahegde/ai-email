import { getGmailClient, parseEmailAddress, getHeader, extractBody } from '../../utils/gmail'

export default defineEventHandler(async (event) => {
  const gmail = await getGmailClient(event)
  const query = getQuery(event)
  const maxResults = Math.min(Number(query.maxResults) || 20, 50)

  const listRes = await gmail.users.drafts.list({
    userId: 'me',
    maxResults
  })

  const drafts = listRes.data.drafts ?? []
  if (drafts.length === 0) {
    return { drafts: [] }
  }

  const draftDetails = await Promise.all(
    drafts.map(d =>
      gmail.users.drafts.get({
        userId: 'me',
        id: d.id!,
        format: 'full'
      })
    )
  )

  const result = draftDetails.map((d, i) => {
    const msg = d.data.message
    const headers = msg?.payload?.headers ?? []
    const to = getHeader(headers, 'To') ?? ''
    const subject = getHeader(headers, 'Subject') ?? '(No subject)'
    const payload = msg?.payload
    let preview = ''
    if (payload) {
      const body = extractBody(payload)
      preview = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
    }
    return {
      id: drafts[i].id,
      messageId: msg?.id,
      threadId: msg?.threadId,
      to: to.split(',')[0]?.trim() ?? '',
      subject,
      preview: preview || 'No preview'
    }
  })

  return { drafts: result }
})
