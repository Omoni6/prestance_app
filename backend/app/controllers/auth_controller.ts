import { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'
import { loginValidator, registerValidator } from '#validators/auth'
import Env from '#start/env'
import { google } from 'googleapis'

export default class AuthController {
  /**
   * Inscription d'un nouvel utilisateur
   */
  public async register({ request, response }: HttpContext) {
    try {
      const payload = await registerValidator.validate(request.all())

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findBy('email', payload.email)
      if (existingUser) {
        return response.conflict({
          error: 'Un utilisateur avec cet email existe déjà',
        })
      }

      // Créer le nouvel utilisateur
      const user = await User.create({
        email: payload.email,
        password: payload.password,
        fullName: payload.fullName,
      })

      // Générer un token d'accès
      const token = await User.accessTokens.create(user)

      return response.created({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          createdAt: user.createdAt,
        },
        token: token.value?.release(),
      })
    } catch (error) {
      console.error('Registration error:', error)
      return response.badRequest({
        error: error.messages || error.message || "Erreur lors de l'inscription",
      })
    }
  }

  /**
   * Connexion d'un utilisateur
   */
  public async login({ request, response }: HttpContext) {
    try {
      const { email, password } = await loginValidator.validate(request.all())

      // Trouver l'utilisateur par email
      const user = await User.findBy('email', email)
      if (!user) {
        return response.unauthorized({
          error: 'Email ou mot de passe incorrect',
        })
      }

      // Vérifier le mot de passe
      const isPasswordValid = await hash.verify(user.password, password)
      if (!isPasswordValid) {
        return response.unauthorized({
          error: 'Email ou mot de passe incorrect',
        })
      }

      // Générer un nouveau token
      const token = await User.accessTokens.create(user)

      return response.ok({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          createdAt: user.createdAt,
        },
        token: token.value?.release(),
      })
    } catch (error) {
      return response.badRequest({
        error: error.messages || 'Erreur lors de la connexion',
      })
    }
  }

  /**
   * Récupérer le profil de l'utilisateur connecté
   */
  public async me({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      return response.ok({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          createdAt: user.createdAt,
        },
      })
    } catch (error) {
      return response.unauthorized({
        error: 'Utilisateur non authentifié',
      })
    }
  }

  /**
   * Déconnexion de l'utilisateur (révocation du token)
   */
  public async logout({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const token = user.currentAccessToken

      if (token) {
        await User.accessTokens.delete(user, token.identifier)
      }

      return response.ok({
        message: 'Déconnexion réussie',
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Erreur lors de la déconnexion',
      })
    }
  }

  /**
   * Redirection vers Google OAuth
   */
  public async googleRedirect({ response }: HttpContext) {
    try {
      const clientId = Env.get('GOOGLE_CLIENT_ID')
      const clientSecret = Env.get('GOOGLE_CLIENT_SECRET')
      // Forcer l'URI correcte pour contourner les problèmes d'environnement
      const redirectUri = 'http://localhost:3333/api/v1/auth/google/callback'

      console.log('Google OAuth Config:', {
        clientId: clientId?.substring(0, 10) + '...',
        clientSecret: clientSecret?.substring(0, 10) + '...',
        redirectUri: redirectUri,
      })

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['email', 'profile'],
        prompt: 'consent',
      })

      console.log('Generated Google OAuth URL:', url)

      return response.redirect(url)
    } catch (error) {
      console.error('Google Redirect Error:', error)
      return response.internalServerError({
        error: 'Erreur lors de la redirection Google OAuth',
      })
    }
  }

  /**
   * Callback Google OAuth
   */
  public async googleCallback({ request, response }: HttpContext) {
    try {
      const code = request.input('code')

      // Forcer l'URI correcte pour contourner les problèmes d'environnement
      const redirectUri = 'http://localhost:3333/api/v1/auth/google/callback'

      const oauth2Client = new google.auth.OAuth2(
        Env.get('GOOGLE_CLIENT_ID'),
        Env.get('GOOGLE_CLIENT_SECRET'),
        redirectUri
      )

      const { tokens } = await oauth2Client.getToken(code)
      oauth2Client.setCredentials(tokens)

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const { data } = await oauth2.userinfo.get()

      let user = await User.findBy('email', data.email)
      let isNewUser = false

      if (!user) {
        user = await User.create({
          email: data.email!,
          fullName: data.name!,
          password: await hash.make(Math.random().toString(36).slice(2)),
        })
        isNewUser = true
      }

      const token = await User.accessTokens.create(user)

      // Rediriger vers la page de callback du frontend avec le token et le statut nouveau utilisateur
      // Le frontend gérera la redirection vers dashboard ou choisir-module
      return response.redirect(
        `${Env.get('FRONTEND_URL')}/auth/callback/google?token=${token.value?.release()}&is_new_user=${isNewUser}`
      )
    } catch (error) {
      return response.internalServerError({
        error: 'Erreur lors du callback Google OAuth',
      })
    }
  }
}
