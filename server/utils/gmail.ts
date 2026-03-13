import { google } from 'googleapis'
import type { H3Event } from 'h3'

export async function getGmailClient(event: H3Event) {
  const session = await requireUserSession(event)
  const secure = (session as { secure?: { accessToken: string; refreshToken?: string } }).secure
  if (!secure?.accessToken) {
    throw createError({ statusCode: 401, message: 'No Gmail access token' })
  }

  const config = useRuntimeConfig(event)
  const oauth2Client = new google.auth.OAuth2(
    config.oauth?.google?.clientId,
    config.oauth?.google?.clientSecret,
    `${config.public?.siteUrl ?? 'http://localhost:3000'}/auth/google`
  )

  oauth2Client.setCredentials({
    access_token: secure.accessToken,
    refresh_token: secure.refreshToken
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

function decodeBase64Url(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

export function parseEmailAddress(header: string | undefined): { name: string; email: string } {
  if (!header) return { name: '', email: '' }
  const match = header.match(/^(?:"?([^"]*)"?\s*)?<?([^>]+)>?$/)
  if (match) {
    const name = (match[1]?.trim() || '').replace(/^"|"$/g, '')
    const email = match[2]?.trim() || ''
    return { name: name || email.split('@')[0], email }
  }
  return { name: header, email: header }
}

export function extractBody(payload: { body?: { data?: string }; parts?: Array<{ body?: { data?: string }; mimeType?: string }> }): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  const htmlPart = payload.parts?.find(p => p.mimeType === 'text/html')
  const textPart = payload.parts?.find(p => p.mimeType === 'text/plain')
  const part = htmlPart ?? textPart ?? payload.parts?.[0]
  if (part?.body?.data) {
    return decodeBase64Url(part.body.data)
  }
  return ''
}

export function getHeader(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string | undefined {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value
}
