import { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import { loginValidator, registerValidator } from '#validators/auth'
import Env from '#start/env'

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 500): Promise<T> {
  let last: any
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e: any) {
      last = e
      const msg = String((e && e.message) || e)
      const code = (e && e.code) || ''
      if (msg.includes('ECONNRESET') || String(code).toUpperCase() === 'ECONNRESET') {
        await sleep(delayMs + i * 250)
        continue
      }
      throw e
    }
  }
  throw last
}

export default class AuthController {
  public async register({ request, response }: HttpContext) {
    try {
      const payload = await registerValidator.validate(request.all())
      const existingUser = await User.findBy('email', payload.email)
      if (existingUser) {
        return response.conflict({ error: 'Un utilisateur avec cet email existe déjà' })
      }
      const user = await User.create({ email: payload.email, password: payload.password, fullName: payload.fullName })
      try { await db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [user.id, 'slack']) } catch {}
      try { await db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [user.id, 'telegram']) } catch {}
      const token = await User.accessTokens.create(user)
      return response.created({ user: { id: user.id, email: user.email, fullName: user.fullName }, token: token.value?.release() })
    } catch (error) {
      return response.badRequest({ error: (error as any).messages || (error as any).message })
    }
  }

  public async login({ request, response }: HttpContext) {
    try {
      const { email, password } = await loginValidator.validate(request.all())
      const user = await User.findBy('email', email)
      if (!user) return response.unauthorized({ error: 'Email ou mot de passe incorrect' })
      const isPasswordValid = await hash.verify(user.password, password)
      if (!isPasswordValid) return response.unauthorized({ error: 'Email ou mot de passe incorrect' })
      const token = await User.accessTokens.create(user)
      return response.ok({ user: { id: user.id, email: user.email, fullName: user.fullName }, token: token.value?.release() })
    } catch (error) {
      return response.badRequest({ error: (error as any).messages || 'Erreur lors de la connexion' })
    }
  }

  public async me({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      return response.ok({ user: { id: user.id, email: user.email, fullName: user.fullName } })
    } catch {
      return response.unauthorized({ error: 'Utilisateur non authentifié' })
    }
  }

  public async logout({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const token = user.currentAccessToken
      if (token) await User.accessTokens.delete(user, token.identifier)
      return response.ok({ message: 'Déconnexion réussie' })
    } catch {
      return response.internalServerError({ error: 'Erreur lors de la déconnexion' })
    }
  }

  public async deleteAccount({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const password = String(request.input('password') || '')
      if (!password) return response.badRequest({ error: 'password_required' })
      const ok = await hash.verify(user.password, password)
      if (!ok) return response.unauthorized({ error: 'invalid_password' })
      try {
        await User.query().where('id', user.id).delete()
      } catch {
        return response.internalServerError({ error: 'delete_failed' })
      }
      return response.ok({ success: true, notice: 'Compte supprimé. Les factures restent dues pour le mois en cours.' })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async googleRedirect({ response }: HttpContext) {
    try {
      const redirectUri = `${Env.get('BACKEND_URL')}/auth/google/callback`
      const { google } = await import('googleapis')
      const oauth2Client = new google.auth.OAuth2(Env.get('GOOGLE_CLIENT_ID'), Env.get('GOOGLE_CLIENT_SECRET'), redirectUri)
      const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: ['profile', 'email'], redirect_uri: redirectUri, prompt: 'consent' })
      return response.redirect(url)
    } catch (error) {
      return response.internalServerError({ error: 'google_redirect_failed', detail: (error as any).message })
    }
  }

  public async googleCallback({ request, response }: HttpContext) {
    try {
      const code = request.input('code')
      if (!code) return response.badRequest({ error: 'missing_code' })
      const redirectUri = `${Env.get('BACKEND_URL')}/auth/google/callback`
      const { google } = await import('googleapis')
      const oauth2Client = new google.auth.OAuth2(Env.get('GOOGLE_CLIENT_ID'), Env.get('GOOGLE_CLIENT_SECRET'), redirectUri)
      const { tokens } = await withRetry(() => oauth2Client.getToken({ code, redirect_uri: redirectUri }))
      oauth2Client.setCredentials(tokens)
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const { data } = await withRetry(() => oauth2.userinfo.get())
      let user = await withRetry(() => User.findBy('email', data.email as string))
      let isNew = false
      if (!user) {
        user = await withRetry(() => User.create({ email: data.email!, fullName: data.name || data.email!.split('@')[0], password: hash.make(Math.random().toString(36)) }))
        isNew = true
        try { await withRetry(() => db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [user.id, 'slack'])) } catch {}
        try { await withRetry(() => db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [user.id, 'telegram'])) } catch {}
      }
      const token = await withRetry(() => User.accessTokens.create(user))
      return response.redirect(`${Env.get('FRONTEND_URL')}/auth/callback/google?token=${token.value?.release()}&is_new_user=${isNew}`)
    } catch (error) {
      return response.internalServerError({ error: 'google_callback_failed', detail: (error as any).message })
    }
  }
}
