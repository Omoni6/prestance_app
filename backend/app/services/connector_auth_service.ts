import { google } from 'googleapis'
import db from '@adonisjs/lucid/services/db'
import Env from '#start/env'

type TokenBundle = { access_token?: string; refresh_token?: string; expiry_date?: number }

export default class ConnectorAuthService {
  getOAuthClient() {
    const clientId = Env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Env.get('GOOGLE_CLIENT_SECRET')
    const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/connectors/google_calendar/callback`
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  }

  async saveTokens(userId: number, connectorCode: string, tokens: TokenBundle, extra?: any) {
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null
    await db.raw(
      'INSERT INTO user_connector_credentials (user_id, connector_code, provider, access_token, refresh_token, expires_at, extra_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW()) ON CONFLICT (user_id, connector_code) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at, extra_json = EXCLUDED.extra_json, updated_at = NOW()',
      [userId, connectorCode, 'google', tokens.access_token || null, tokens.refresh_token || null, expiresAt, extra ? JSON.stringify(extra) : null]
    )
  }

  async getStoredTokens(userId: number, connectorCode: string): Promise<(TokenBundle & { extra_json?: any }) | null> {
    const row: any = await db
      .from('user_connector_credentials')
      .where({ user_id: userId, connector_code: connectorCode })
      .select('access_token', 'refresh_token', 'expires_at', 'extra_json')
      .first()
      .catch(() => null)
    if (!row) return null
    const expiry_date = row.expires_at ? new Date(row.expires_at).getTime() : undefined
    return { access_token: row.access_token || undefined, refresh_token: row.refresh_token || undefined, expiry_date, extra_json: row.extra_json || undefined }
  }
}
