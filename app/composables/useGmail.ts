import type { MailThread, MailMessage } from '~/types/mail'

function parseThreadTimestamp(t: MailThread): MailThread {
  return {
    ...t,
    timestamp: t.timestamp instanceof Date ? t.timestamp : new Date(t.timestamp as unknown as string)
  }
}

export function useGmailThreads(query?: { maxResults?: number, q?: string, labelIds?: string[], pageToken?: string }) {
  const { data, error, refresh, status } = useFetch<{ threads: MailThread[], nextPageToken?: string }>('/api/gmail/threads', {
    query: query as Record<string, string | number | string[] | undefined>,
    default: () => ({ threads: [], nextPageToken: undefined })
  })
  const threads = computed(() => (data.value?.threads ?? []).map(parseThreadTimestamp))
  return { data, error, refresh, status, threads }
}

export function useGmailThread(threadId: Ref<string | null> | string | null) {
  const id = computed(() => (typeof threadId === 'object' && threadId !== null ? threadId.value : threadId))
  const { data, error, refresh, status } = useFetch<{
    id: string
    messages: MailMessage[]
    subject: string
    participants: Array<{ email: string, name: string }>
  }>(() => (id.value ? `/api/gmail/thread/${id.value}` : null), {
    default: () => ({ id: '', messages: [], subject: '', participants: [] })
  })
  const thread = computed(() => {
    const d = data.value
    if (!d) return null
    return {
      ...d,
      messages: (d.messages ?? []).map(m => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp as unknown as string)
      }))
    }
  })
  return { data, error, refresh, status, thread }
}

export function useGmailLabels() {
  return useFetch<{ labels: Array<{ id: string, name: string, type?: string }> }>('/api/gmail/labels', {
    default: () => ({ labels: [] })
  })
}

// Reads from local DB instead of Gmail API directly
export function useThreads(query?: { label?: string, unread?: '1', limit?: number, offset?: number }) {
  const { data, error, refresh, status } = useFetch<{
    threads: Array<{
      id: string
      subject: string
      snippet: string
      participants: { name: string, email: string }[]
      unread: boolean
      messageCount: number
      lastMessageAt: number
      syncedAt: number
    }>
  }>('/api/threads', {
    query: query as Record<string, string | number | undefined>,
    default: () => ({ threads: [] })
  })

  const threads = computed(() =>
    (data.value?.threads ?? []).map(t => ({
      ...t,
      timestamp: new Date(t.lastMessageAt * 1000)
    }))
  )

  return { data, error, refresh, status, threads }
}
