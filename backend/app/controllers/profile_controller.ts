import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class ProfileController {
  public async show({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      return response.ok({ profile: { id: user.id, email: user.email, fullName: user.fullName, notificationsEnabled: !!user.notificationsEnabled } })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async update({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const fullName = request.input('fullName')
      const notificationsEnabledRaw = request.input('notificationsEnabled')
      const notificationsEnabled = typeof notificationsEnabledRaw === 'string' ? notificationsEnabledRaw.toLowerCase() === 'true' : !!notificationsEnabledRaw
      try {
        // Persist known fields
        await User.query().where('id', user.id).update({ fullName, notificationsEnabled })
      } catch {}
      return response.ok({ success: true, user: { id: user.id, fullName, notificationsEnabled } })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async updateAvatar({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const avatarUrl = String(request.input('avatarUrl') || '')
      if (!avatarUrl) return response.badRequest({ error: 'avatar_url_required' })
      await User.query().where('id', user.id).update({ avatarUrl })
      return response.ok({ success: true, user: { id: user.id, avatarUrl } })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}
