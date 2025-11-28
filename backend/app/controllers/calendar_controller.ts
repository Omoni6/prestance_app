import type { HttpContext } from '@adonisjs/core/http'
import { google } from 'googleapis'
import Env from '#start/env'
import ConnectorAuthService from '#services/connector_auth_service'

export default class CalendarController {
  public async list({ auth, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      return response.ok({ events: [] })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async create({ auth, request, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const payload = request.all()
      return response.ok({ success: true, event: payload })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async delete({ auth, params, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      return response.ok({ success: true, id: params.id })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async upcoming({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const authSvc = new ConnectorAuthService()
      const tokens = await authSvc.getStoredTokens(Number(user.id), 'google_calendar')
      const clientId = Env.get('GOOGLE_CLIENT_ID')
      const clientSecret = Env.get('GOOGLE_CLIENT_SECRET')
      const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/google_calendar/callback`
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
      if (tokens?.access_token) oauth2Client.setCredentials({ access_token: tokens.access_token, refresh_token: tokens.refresh_token })
      const cal = google.calendar({ version: 'v3', auth: oauth2Client })
      const now = new Date()
      const end = new Date(now.getTime() + 7*24*60*60*1000)
      const res = await cal.events.list({ calendarId: 'primary', timeMin: now.toISOString(), timeMax: end.toISOString(), singleEvents: true, orderBy: 'startTime', maxResults: 10 })
      const events = (res.data.items || []).map((e)=> ({ id: e.id, summary: e.summary, start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date, htmlLink: e.htmlLink }))
      return response.ok({ events })
    } catch {
      return response.ok({ events: [] })
    }
  }
}
