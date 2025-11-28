import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class DeliveriesController {
  public async create({ auth, params, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const projectId = Number(params.id)
      const type = String(request.input('type') || '').toLowerCase()
      const title = String(request.input('title') || '')
      const url = String(request.input('url') || '')
      const storageKey = String(request.input('storage_key') || '')
      const channels = request.input('channels') || ['email']
      const ins: any = await db.raw('INSERT INTO project_deliveries (project_id, type, title, url, storage_key, channels, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW()) RETURNING id', [projectId || null, type, title, url, storageKey, JSON.stringify(channels), 'queued'])
      const id = Number(ins?.rows?.[0]?.id || 0)
      await db.raw('INSERT INTO outbox (type, target, payload_json, status, created_at) VALUES (?, ?, ?, ?, NOW())', ['deliver.send', type, JSON.stringify({ user_id: Number(user.id), project_id: projectId || null, delivery_id: id, channels }), 'pending'])
      return response.ok({ success: true, delivery_id: id })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async list({ auth, params, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const projectId = Number(params.id)
      const rows = await db.from('project_deliveries').where('project_id', projectId).select('*').orderBy('created_at', 'desc')
      return response.ok({ deliveries: rows })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async listUser({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const rows = await db.raw(
        'SELECT d.* FROM project_deliveries d LEFT JOIN projects p ON d.project_id = p.id WHERE (p.user_id = ? OR d.project_id IS NULL) ORDER BY d.created_at DESC',
        [Number(user.id)]
      )
      return response.ok({ deliveries: (rows as any)?.rows || [] })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async delete({ auth, params, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const projectId = Number(params.id)
      const deliveryId = Number(params.deliveryId)
      const row: any = await db.from('project_deliveries').where({ id: deliveryId, project_id: projectId }).select('storage_key').first()
      if (!row?.storage_key) {
        await db.from('project_deliveries').where({ id: deliveryId, project_id: projectId }).delete()
        return response.ok({ success: true })
      }
      try {
        const { default: MinioService } = await import('#services/minio_service')
        const svc = new MinioService()
        await svc.removeFile(String(row.storage_key))
      } catch {}
      await db.from('project_deliveries').where({ id: deliveryId, project_id: projectId }).delete()
      return response.ok({ success: true })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async dispatchOne({ auth, params, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const projectId = Number(params.id)
      const deliveryId = Number(params.deliveryId)
      const row: any = await db.from('project_deliveries').where({ id: deliveryId, project_id: projectId }).select('channels').first()
      const channels = row?.channels || ['email']
      await db.raw('INSERT INTO outbox (type, target, payload_json, status, created_at) VALUES (?, ?, ?, ?, NOW())', ['deliver.send', 'document', JSON.stringify({ user_id: Number(user.id), project_id: projectId || null, delivery_id: deliveryId, channels }), 'pending'])
      return response.ok({ success: true })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}
