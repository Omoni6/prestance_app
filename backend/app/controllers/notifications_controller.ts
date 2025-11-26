import type { HttpContext } from '@adonisjs/core/http'

export default class NotificationsController {
  public async list({ auth, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      return response.ok({ notifications: [] })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async markAsRead({ auth, request, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const ids = request.input('ids') || []
      return response.ok({ success: true, ids })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}

