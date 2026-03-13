export type AiTag = 'action-required' | 'question' | 'decision' | 'meeting' | 'fyi'

export interface MailParticipant {
  email: string
  name: string
  avatar?: string
}

export interface MailThread {
  id: string
  participants: MailParticipant[]
  subject: string
  snippet: string
  timestamp: Date
  unread: boolean
  messageCount: number
}

export interface MailMessage {
  id: string
  from: MailParticipant
  to: MailParticipant[]
  cc?: MailParticipant[]
  subject: string
  body: string
  timestamp: Date
  isReply?: boolean
}

export interface ThreadAnalysis {
  summary: string[]
  actionItems: { text: string, due?: string }[]
  questions: string[]
  decisions: string[]
  people: Array<{
    name: string
    email: string
    company?: string
    lastInteraction?: string
    notes?: string
  }>
}
