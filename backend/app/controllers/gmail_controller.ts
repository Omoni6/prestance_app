import type { HttpContext } from '@adonisjs/core/http'
import { google } from 'googleapis'
import Env from '#start/env'
import ConnectorAuthService from '#services/connector_auth_service'

function headerVal(headers: any[], name: string) {
  const h = headers.find((x: any) => String(x.name).toLowerCase() === name.toLowerCase())
  return h ? String(h.value || '') : ''
}

export default class GmailController {
  private async getClient(userId: number) {
    const authSvc = new ConnectorAuthService()
    const tokens = await authSvc.getStoredTokens(userId, 'gmail')
    const clientId = Env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Env.get('GOOGLE_CLIENT_SECRET')
    const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/gmail/callback`
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    oauth2Client.setCredentials({ access_token: tokens?.access_token, refresh_token: tokens?.refresh_token })
    return oauth2Client
  }

  public async messages({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const q = String((request.qs() as any).q || '')
      const max = Math.min(Number((request.qs() as any).max || 20), 50)
      const authSvc = new ConnectorAuthService()
      const stored = await authSvc.getStoredTokens(Number(user.id), 'gmail')
      const scopes = Array.isArray(stored?.extra_json?.scopes) ? stored!.extra_json.scopes : []
      if (scopes.length && !scopes.includes('https://www.googleapis.com/auth/gmail.readonly')) {
        return response.forbidden({ error: 'insufficient_scopes' })
      }
      const client = await this.getClient(Number(user.id))
      const gmail = google.gmail({ version: 'v1', auth: client })
      const list = await gmail.users.messages.list({ userId: 'me', maxResults: max, q: q || undefined })
      const ids = (list.data.messages || []).map((m: any) => String(m.id))
      const out: any[] = []
      for (const id of ids) {
        const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From','Subject','Date'] })
        const headers = msg.data.payload?.headers || []
        out.push({ id, from: headerVal(headers, 'From'), subject: headerVal(headers, 'Subject'), date: headerVal(headers, 'Date'), snippet: String(msg.data.snippet || '') })
      }
      return response.ok({ messages: out })
    } catch (e) {
      return response.badRequest({ error: 'gmail_list_failed' })
    }
  }
}
