import type { HttpContext } from '@adonisjs/core/http'

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
}

