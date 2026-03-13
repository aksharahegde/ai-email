import { getGmailClient } from '../../utils/gmail'

export default defineEventHandler(async (event) => {
  const gmail = await getGmailClient(event)
  const res = await gmail.users.labels.list({ userId: 'me' })
  const labels = (res.data.labels ?? []).map(l => ({
    id: l.id,
    name: l.name,
    type: l.type,
    messageListVisibility: l.messageListVisibility,
    labelListVisibility: l.labelListVisibility
  }))
  return { labels }
})
