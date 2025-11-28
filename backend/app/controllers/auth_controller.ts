import { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'
import { loginValidator, registerValidator } from '#validators/auth'
import Env from '#start/env'

export default class AuthController {
  public async register({ request, response }: HttpContext) {
    try {
      const payload = await registerValidator.validate(request.all())
      const existingUser = await User.findBy('email', payload.email)
      if (existingUser) {
        return response.conflict({ error: 'Un utilisateur avec cet email existe déjà' })
      }
      const user = await User.create({ email: payload.email, password: payload.password, fullName: payload.fullName })
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

  public async googleRedirect({ response }: HttpContext) {
    try {
      const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/auth/google/callback`
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
      const redirectUri = `${Env.get('BACKEND_URL')}/api/v1/auth/google/callback`
      const { google } = await import('googleapis')
      const oauth2Client = new google.auth.OAuth2(Env.get('GOOGLE_CLIENT_ID'), Env.get('GOOGLE_CLIENT_SECRET'), redirectUri)
      const { tokens } = await oauth2Client.getToken({ code, redirect_uri: redirectUri })
      oauth2Client.setCredentials(tokens)
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const { data } = await oauth2.userinfo.get()
      let user = await User.findBy('email', data.email)
      let isNew = false
      if (!user) {
        user = await User.create({ email: data.email!, fullName: data.name || data.email!.split('@')[0], password: await hash.make(Math.random().toString(36)) })
        isNew = true
      }
      const token = await User.accessTokens.create(user)
      return response.redirect(`${Env.get('FRONTEND_URL')}/auth/callback/google?token=${token.value?.release()}&is_new_user=${isNew}`)
    } catch (error) {
      return response.internalServerError({ error: 'google_callback_failed', detail: (error as any).message })
    }
  }
}
