import { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'
import Env from '#start/env'

export default class OAuthController {
  /**
   * Rediriger vers Google OAuth
   */
  public async googleRedirect({ response, request }: HttpContext) {
    try {
      ;(global as any).__recentRedirects ||= new Map<string, number>()
      const store: Map<string, number> = (global as any).__recentRedirects
      const ip = request.ip()
      const last = store.get(ip) || 0
      if (Date.now() - last < 4000) {
        return response.redirect(Env.get('FRONTEND_URL', 'http://localhost:3003') + '/auth/signin')
      }
      store.set(ip, Date.now())
      const clientId = Env.get('GOOGLE_CLIENT_ID')
      const raw = Env.get('GOOGLE_REDIRECT_URI')
      const callbackUrl =
        raw && raw.includes('localhost:3003')
          ? 'http://localhost:3333/api/v1/auth/google/callback'
          : raw || 'http://localhost:3333/api/v1/auth/google/callback'
      const scope = encodeURIComponent('profile email')
      const redirectUri = encodeURIComponent(callbackUrl)
      const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&access_type=offline&prompt=consent`
      console.log('🔵 Google redirect URL:', url)
      console.log('🟦 Redirect invoked from:', {
        ip: request.ip(),
        host: request.hostname(),
        path: request.url(),
      })
      return response.redirect(url)
    } catch (error) {
      console.error('Google redirect error:', error)
      return {
        error: 'Erreur lors de la redirection Google OAuth',
      }
    }
  }

  /**
   * Callback Google OAuth
   */
  public async googleCallback({ ally, response, request }: HttpContext) {
    try {
      const driver = ally.use('google').stateless()
      const rawParams = request.qs()
      console.log('🟥 RAW QUERY PARAMS:', rawParams)
      console.log('🟣 Callback received at path:', request.url())
      if (rawParams.code) {
        console.log('🟣 OAuth code length:', String(rawParams.code).length)
      }
      if (rawParams.error) {
        console.error('🟥 OAuth error param:', rawParams.error, rawParams.error_description || '')
      }
      const rawRedirect = Env.get('GOOGLE_REDIRECT_URI')
      const effectiveRedirect =
        rawRedirect && rawRedirect.includes('localhost:3003')
          ? 'http://localhost:3333/api/v1/auth/google/callback'
          : rawRedirect || 'http://localhost:3333/api/v1/auth/google/callback'
      console.log('🟠 Redirect URI (effective):', effectiveRedirect, '| raw:', rawRedirect)
      if (!rawParams.code || rawParams.code === 'test') {
        console.warn('⚠️ Callback ignoré (appel fantôme / invalide). Params:', rawParams)
        return response.redirect(`${Env.get('FRONTEND_URL', 'http://localhost:3003')}/auth/signin`)
      }
      const googleUser = await driver.user()

      console.log('Google user received:', {
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.avatarUrl,
      })

      // Trouver ou créer l'utilisateur
      let user = await User.findBy('email', googleUser.email)
      let isNewUser = false

      if (!user) {
        // Créer un nouvel utilisateur
        user = await User.create({
          email: googleUser.email,
          fullName: googleUser.name || googleUser.email.split('@')[0],
          password: await hash.make(Math.random().toString(36).slice(2)),
        })
        isNewUser = true
        console.log('New user created:', user.email)
      } else {
        console.log('Existing user found:', user.email)
      }

      // Créer un token d'accès
      const token = await User.accessTokens.create(user)
      console.log('Access token created for user:', user.email)

      // Rediriger vers le frontend avec le token
      const frontendUrl = Env.get('FRONTEND_URL', 'http://localhost:3003')
      const redirectUrl = `${frontendUrl}/auth/callback/google?token=${token.value?.release()}&is_new_user=${isNewUser}`

      console.log('Redirecting to frontend:', redirectUrl)

      return response.redirect(redirectUrl)
    } catch (error) {
      console.error('Google callback error:', error)
      return response.redirect(
        `${Env.get('FRONTEND_URL', 'http://localhost:3003')}/auth/signin?error=OAuthCallback`
      )
    }
  }
}
