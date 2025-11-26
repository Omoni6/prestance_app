import type { HttpContext } from '@adonisjs/core/http'

export default class ProfileController {
  public async show({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      return response.ok({ profile: { id: user.id, email: user.email, fullName: user.fullName } })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async update({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const fullName = request.input('fullName')
      // placeholder update
      return response.ok({ success: true, user: { id: user.id, fullName } })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async updateAvatar({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const avatarUrl = request.input('avatarUrl')
      return response.ok({ success: true, user: { id: user.id, avatarUrl } })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}

