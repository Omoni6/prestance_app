import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class LogsController {
  public async action({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const name = String(request.input('name') || '').trim()
      const params = request.input('params') || {}
      if (!name) return response.badRequest({ error: 'name_required' })
      await db.raw('INSERT INTO activity_logs (user_id, action_name, params_json, created_at) VALUES (?, ?, ?, NOW())', [Number(user.id), name, JSON.stringify(params)])
      return response.ok({ success: true })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}

