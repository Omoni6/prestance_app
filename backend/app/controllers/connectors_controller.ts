import type { HttpContext } from '@adonisjs/core/http'
import ConnectorService from '#services/connector_service'
import db from '@adonisjs/lucid/services/db'
import { google } from 'googleapis'
import Env from '#start/env'
import ConnectorAuthService from '#services/connector_auth_service'

export default class ConnectorsController {
  public async list({ response }: HttpContext) {
    const rows: any = await db.rawQuery("SELECT code FROM connectors")
    const connectors = (rows?.rows || []).map((r: any) => ({ code: String(r.code), name: String(r.code) }))
    return response.ok({ connectors })
  }

  public async listPremium({ response }: HttpContext) {
    try {
      const rows: any = await db.rawQuery("SELECT code FROM connectors")
      const connectors = (rows?.rows || []).map((r: any) => ({ code: String(r.code), name: String(r.code) }))
      return response.ok({ connectors })
    } catch {
      return response.ok({ connectors: [] })
    }
  }

  public async activate({ auth, request, response }: HttpContext) {
    const user = await auth.use('api').authenticate()
    const connectorKey = String(request.input('connector') || request.params().key || '').trim()
    const svc = new ConnectorService()
    await svc.activateConnector(Number(user.id), connectorKey)
    return response.ok({ success: true, connector: connectorKey })
  }

  public async deactivate({ auth, request, response }: HttpContext) {
    const user = await auth.use('api').authenticate()
    const connectorKey = String(request.input('connector') || request.params().key || '').trim()
    const svc = new ConnectorService()
    await svc.deactivateConnector(Number(user.id), connectorKey)
    return response.ok({ success: true, connector: connectorKey })
  }

  public async listByModule({ auth, params, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const svc = new ConnectorService()
      const { included, premium } = await svc.listByModule(Number(user.id), String(params.key))
      return response.ok({ included, premium })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async redirect({ params, request, response }: HttpContext) {
    const key = String(params.key)
    if (key === 'google_calendar') {
      const clientId = Env.get('GOOGLE_CLIENT_ID')
      const clientSecret = Env.get('GOOGLE_CLIENT_SECRET')
      const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/google_calendar/callback`
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
      const scopes = ['https://www.googleapis.com/auth/calendar.readonly']
      const state = String((request.qs() as any).state || '')
      const url = oauth2Client.generateAuthUrl({ scope: scopes, access_type: 'offline', prompt: 'consent', redirect_uri: redirectUri, state })
      return response.redirect(url)
    }
    if (key === 'google_drive') {
      const clientId = Env.get('GOOGLE_CLIENT_ID')
      const clientSecret = Env.get('GOOGLE_CLIENT_SECRET')
      const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/google_drive/callback`
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
      const scopes = ['https://www.googleapis.com/auth/drive.readonly']
      const state = String((request.qs() as any).state || '')
      const url = oauth2Client.generateAuthUrl({ scope: scopes, access_type: 'offline', prompt: 'consent', redirect_uri: redirectUri, state })
      return response.redirect(url)
    }
    if (key === 'gmail') {
      const clientId = Env.get('GOOGLE_CLIENT_ID')
      const clientSecret = Env.get('GOOGLE_CLIENT_SECRET')
      const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/gmail/callback`
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
      const scopes = ['https://www.googleapis.com/auth/gmail.readonly']
      const state = String((request.qs() as any).state || '')
      const url = oauth2Client.generateAuthUrl({ scope: scopes, access_type: 'offline', prompt: 'consent', redirect_uri: redirectUri, state })
      return response.redirect(url)
    }
    if (key === 'slack') {
      const clientId = String(Env.get('SLACK_CLIENT_ID') || '')
      const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/slack/callback`
      const state = String((request.qs() as any).state || '')
      if (!clientId) return response.badRequest({ error: 'missing_slack_client_id' })
      const scopes = ['channels:read','chat:write','users:read']
      const url = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scopes.join(','))}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
      return response.redirect(url)
    }
    if (key === 'notion') {
      const clientId = String(Env.get('NOTION_CLIENT_ID') || '')
      const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/notion/callback`
      const state = String((request.qs() as any).state || '')
      if (!clientId) return response.badRequest({ error: 'missing_notion_client_id' })
      const url = `https://api.notion.com/v1/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
      return response.redirect(url)
    }
    if (key === 'calendly') {
      // Calendly généralement via token API: utiliser /config côté backend
      return response.badRequest({ error: 'use_config_for_calendly' })
    }
    if (key === 'blotato') {
      const authorizeUrl = String(Env.get('BLOTATO_AUTHORIZE_URL') || '')
      const clientId = String(Env.get('BLOTATO_CLIENT_ID') || '')
      const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/blotato/callback`
      const state = String((request.qs() as any).state || '')
      if (!authorizeUrl || !clientId) return response.badRequest({ error: 'missing_blotato_env' })
      const url = `${authorizeUrl}?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
      return response.redirect(url)
    }
    return response.badRequest({ error: 'unknown_provider' })
  }

  public async callback({ params, request, response }: HttpContext) {
    const key = String(params.key)
    if (key === 'google_calendar') {
      try {
        const code = (request.input('code') || (request.qs() as any).code)
        const clientId = Env.get('GOOGLE_CLIENT_ID')
        const clientSecret = Env.get('GOOGLE_CLIENT_SECRET')
        const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/google_calendar/callback`
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
        const { tokens } = await oauth2Client.getToken({ code, redirect_uri: redirectUri })
        const authSvc = new ConnectorAuthService()
        const userId = Number(String((request.qs() as any).state || '0'))
        if (!userId) return response.badRequest({ error: 'missing_user_state' })
        await authSvc.saveTokens(userId, 'google_calendar', { access_token: tokens.access_token || undefined, refresh_token: tokens.refresh_token || undefined, expiry_date: tokens.expiry_date as any }, { scopes: ['https://www.googleapis.com/auth/calendar.readonly'] })
        try { await db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [userId, 'google_calendar']) } catch {}
        return response.redirect(`${Env.get('FRONTEND_URL')}/connectors/callback/google_calendar?status=success`)
      } catch (e) {
        const detail = encodeURIComponent(String((e as any)?.message || ''))
        return response.redirect(`${Env.get('FRONTEND_URL')}/connectors/callback/google_calendar?status=error&detail=${detail}`)
      }
    }
    if (key === 'google_drive') {
      try {
        const code = (request.input('code') || (request.qs() as any).code)
        const clientId = Env.get('GOOGLE_CLIENT_ID')
        const clientSecret = Env.get('GOOGLE_CLIENT_SECRET')
        const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/google_drive/callback`
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
        const { tokens } = await oauth2Client.getToken({ code, redirect_uri: redirectUri })
        const authSvc = new ConnectorAuthService()
        const userId = Number(String((request.qs() as any).state || '0'))
        if (!userId) return response.badRequest({ error: 'missing_user_state' })
        await authSvc.saveTokens(userId, 'google_drive', { access_token: tokens.access_token || undefined, refresh_token: tokens.refresh_token || undefined, expiry_date: tokens.expiry_date as any }, { scopes: ['https://www.googleapis.com/auth/drive.readonly'] })
        try { await db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [userId, 'google_drive']) } catch {}
        return response.redirect(`${Env.get('FRONTEND_URL')}/connectors/callback/google_drive?status=success`)
      } catch (e) {
        const detail = encodeURIComponent(String((e as any)?.message || ''))
        return response.redirect(`${Env.get('FRONTEND_URL')}/connectors/callback/google_drive?status=error&detail=${detail}`)
      }
    }
    if (key === 'gmail') {
      try {
        const code = (request.input('code') || (request.qs() as any).code)
        const clientId = Env.get('GOOGLE_CLIENT_ID')
        const clientSecret = Env.get('GOOGLE_CLIENT_SECRET')
        const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/gmail/callback`
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
        const { tokens } = await oauth2Client.getToken({ code, redirect_uri: redirectUri })
        const authSvc = new ConnectorAuthService()
        const userId = Number(String((request.qs() as any).state || '0'))
        if (!userId) return response.badRequest({ error: 'missing_user_state' })
        await authSvc.saveTokens(userId, 'gmail', { access_token: tokens.access_token || undefined, refresh_token: tokens.refresh_token || undefined, expiry_date: tokens.expiry_date as any }, { scopes: ['https://www.googleapis.com/auth/gmail.readonly'] })
        try { await db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [userId, 'gmail']) } catch {}
        return response.redirect(`${Env.get('FRONTEND_URL')}/connectors/callback/gmail?status=success`)
      } catch (e) {
        const detail = encodeURIComponent(String((e as any)?.message || ''))
        return response.redirect(`${Env.get('FRONTEND_URL')}/connectors/callback/gmail?status=error&detail=${detail}`)
      }
    }
    if (key === 'slack') {
      try {
        const code = (request.input('code') || (request.qs() as any).code)
        const clientId = String(Env.get('SLACK_CLIENT_ID') || '')
        const clientSecret = String(Env.get('SLACK_CLIENT_SECRET') || '')
        const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/slack/callback`
        if (!clientId || !clientSecret) return response.badRequest({ error: 'missing_slack_env' })
        const resp = await fetch('https://slack.com/api/oauth.v2.access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }).toString(),
        })
        const data: any = await resp.json()
        if (!data.ok) return response.badRequest({ error: 'slack_oauth_failed', detail: data.error })
        const token = String(data.access_token || '')
        const userId = Number(String((request.qs() as any).state || '0'))
        if (!userId) return response.badRequest({ error: 'missing_user_state' })
        await db.raw('INSERT INTO user_connector_credentials (user_id, connector_code, provider, access_token, extra_json, created_at) VALUES (?, ?, ?, ?, ?, NOW()) ON CONFLICT (user_id, connector_code) DO UPDATE SET access_token = EXCLUDED.access_token, extra_json = EXCLUDED.extra_json, updated_at = NOW()', [userId, 'slack', 'slack', token, JSON.stringify({ scopes: String(data.scope || '') })])
        try { await db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [userId, 'slack']) } catch {}
        return response.redirect(`${Env.get('FRONTEND_URL')}/connectors/callback/slack?status=success`)
      } catch (e) {
        return response.badRequest({ error: 'callback_failed', provider: 'slack' })
      }
    }
    if (key === 'notion') {
      try {
        const code = (request.input('code') || (request.qs() as any).code)
        const clientId = String(Env.get('NOTION_CLIENT_ID') || '')
        const clientSecret = String(Env.get('NOTION_CLIENT_SECRET') || '')
        const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/notion/callback`
        if (!clientId || !clientSecret) return response.badRequest({ error: 'missing_notion_env' })
        const resp = await fetch('https://api.notion.com/v1/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret })
        })
        const data: any = await resp.json()
        const token = String(data.access_token || '')
        const userId = Number(String((request.qs() as any).state || '0'))
        if (!userId) return response.badRequest({ error: 'missing_user_state' })
        await db.raw('INSERT INTO user_connector_credentials (user_id, connector_code, provider, access_token, created_at) VALUES (?, ?, ?, ?, NOW()) ON CONFLICT (user_id, connector_code) DO UPDATE SET access_token = EXCLUDED.access_token, updated_at = NOW()', [userId, 'notion', 'notion', token])
        try { await db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [userId, 'notion']) } catch {}
        return response.redirect(`${Env.get('FRONTEND_URL')}/connectors/callback/notion?status=success`)
      } catch (e) {
      return response.badRequest({ error: 'callback_failed', provider: 'notion' })
    }
    if (key === 'blotato') {
      try {
        const code = (request.input('code') || (request.qs() as any).code)
        const tokenUrl = String(Env.get('BLOTATO_TOKEN_URL') || '')
        const clientId = String(Env.get('BLOTATO_CLIENT_ID') || '')
        const clientSecret = String(Env.get('BLOTATO_CLIENT_SECRET') || '')
        const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/blotato/callback`
        if (!tokenUrl || !clientId || !clientSecret) return response.badRequest({ error: 'missing_blotato_env' })
        const resp = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }).toString(),
        })
        const data: any = await resp.json()
        const token = String(data.access_token || '')
        const userId = Number(String((request.qs() as any).state || '0'))
        if (!userId) return response.badRequest({ error: 'missing_user_state' })
        await db.raw('INSERT INTO user_connector_credentials (user_id, connector_code, provider, access_token, created_at) VALUES (?, ?, ?, ?, NOW()) ON CONFLICT (user_id, connector_code) DO UPDATE SET access_token = EXCLUDED.access_token, updated_at = NOW()', [userId, 'blotato', 'blotato', token])
        try { await db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [userId, 'blotato']) } catch {}
        return response.redirect(`${Env.get('FRONTEND_URL')}/connectors/callback/blotato?status=success`)
      } catch (e) {
        return response.badRequest({ error: 'callback_failed', provider: 'blotato' })
      }
    }
    return response.badRequest({ error: 'unknown_provider' })
  }
  }

  public async config({ auth, params, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const key = String(params.key)
      const payload = request.all()
      if (key === 'smtp') {
        const host = String(payload.host || '')
        const port = Number(payload.port || 0)
        const userField = String(payload.user || '')
        const pass = String(payload.password || payload.pass || '')
        const from = String(payload.from || '')
        if (!host || !port || !userField || !pass || !from) {
          return response.badRequest({ error: 'invalid_smtp_config', required: ['host','port','user','password','from'] })
        }
      }
      await db.raw('INSERT INTO user_connector_credentials (user_id, connector_code, provider, extra_json, created_at) VALUES (?, ?, ?, ?, NOW()) ON CONFLICT (user_id, connector_code) DO UPDATE SET extra_json = EXCLUDED.extra_json, updated_at = NOW()', [Number(user.id), key, key, JSON.stringify(payload)])
      try { await db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [Number(user.id), key]) } catch {}
      if (key === 'smtp') {
        try {
          const webhook = String(Env.get('SLACK_WEBHOOK_URL') || Env.get('SLACK_OPS_WEBHOOK_URL') || '')
          if (webhook) {
            const text = `⚙️ SMTP configuré par user #${user.id}\nHost: ${payload.host || ''}\nUser: ${payload.user || ''}\nFrom: ${payload.from || ''}`
            await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
          }
        } catch {}
      }
      return response.ok({ success: true })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}
