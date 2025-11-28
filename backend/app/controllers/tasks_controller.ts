import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class TasksController {
  public async listUser({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const rows = await db.from('tasks').where('user_id', Number(user.id)).select('id','title','status','project_id','created_at','updated_at').orderBy('created_at','desc')
      return response.ok({ tasks: rows })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async update({ auth, params, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const id = Number(params.id)
      const status = String(request.input('status') || '').toLowerCase() || 'todo'
      await db.from('tasks').where({ id, user_id: Number(user.id) }).update({ status, updated_at: new Date() })
      return response.ok({ success: true })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}

