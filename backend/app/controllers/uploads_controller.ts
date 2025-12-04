import type { HttpContext } from '@adonisjs/core/http'
import MinioService from '#services/minio_service'
import { promises as fs } from 'node:fs'
import User from '#models/user'

export default class UploadsController {
  public async upload({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const file: any = request.file('file')
      if (!file) return response.badRequest({ error: 'no_file' })

      let buffer: Buffer | null = null
      try {
        if (typeof file.toBuffer === 'function') buffer = await file.toBuffer()
      } catch {}
      if (!buffer) {
        const tmp = (file as any).tmpPath
        if (!tmp) return response.badRequest({ error: 'invalid_upload' })
        buffer = await fs.readFile(tmp)
      }

      const svc = new MinioService()
      const isBranding = Boolean(request.input('branding'))
      const isInvoice = String(request.input('invoice') || '').toLowerCase() === 'true'
      const basePath = isInvoice ? `clients/${user.id}/invoices` : (isBranding ? `clients/${user.id}/logos` : `clients/${user.id}/docs`)
      const orig = String((file?.clientName || file?.fileName || 'upload.bin')).replace(/[^\w\.-]+/g, '_')
      const result = await svc.uploadFile(buffer, basePath, orig)
      // Optional: create a deliverable directly after upload
      const asDelivery = String(request.input('as_delivery') || '').toLowerCase() === 'true'
      if (asDelivery) {
        try {
          const db = (await import('@adonisjs/lucid/services/db')).default
          const channels = Array.isArray(request.input('channels')) ? request.input('channels') : ['email']
          const title = String(request.input('title') || orig)
          // infer type from extension
          const ext = (orig.split('.').pop() || '').toLowerCase()
          const typeMap: Record<string,string> = { png:'image', jpg:'image', jpeg:'image', webp:'image', mp4:'video', mov:'video', webm:'video', mp3:'audio', wav:'audio', pdf:'document', docx:'document', txt:'document' }
          const type = typeMap[ext] || 'document'
          const projectId = Number(request.input('project_id') || 0) || null
          const ins: any = await db.raw('INSERT INTO project_deliveries (project_id, type, title, url, storage_key, channels, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW()) RETURNING id', [projectId, type, title, result.url, result.key, JSON.stringify(channels), 'queued'])
          const deliveryId = Number(ins?.rows?.[0]?.id || 0)
          await db.raw('INSERT INTO outbox (type, target, payload_json, status, created_at) VALUES (?, ?, ?, ?, NOW())', ['deliver.send', type, JSON.stringify({ user_id: Number(user.id), project_id: projectId, delivery_id: deliveryId, channels }), 'pending'])
          return response.ok({ success: true, path: result.key, key: result.key, url: result.url, delivery_id: deliveryId })
        } catch {
          return response.ok({ success: true, path: result.key, key: result.key, url: result.url, delivery_id: null })
        }
      }
      return response.ok({ success: true, path: result.key, key: result.key, url: result.url })
    } catch (err) {
      return response.internalServerError({ error: 'upload_failed' })
    }
  }

  public async uploadOnboarding({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const file: any = request.file('file')
      if (!file) return response.badRequest({ error: 'no_file' })

      let buffer: Buffer | null = null
      try {
        if (typeof file.toBuffer === 'function') buffer = await file.toBuffer()
      } catch {}
      if (!buffer) {
        const tmp = (file as any).tmpPath
        if (!tmp) return response.badRequest({ error: 'invalid_upload' })
        buffer = await fs.readFile(tmp)
      }

      const svc = new MinioService()
      const basePath = `clients/${user.id}/logos`
      const orig = String((file?.clientName || file?.fileName || 'upload.bin')).replace(/[^\w\.-]+/g, '_')
      const result = await svc.uploadFile(buffer, basePath, orig)

      const setAvatar = String(request.input('setAvatar') || '').toLowerCase() === 'true'
      if (setAvatar) {
        await User.query().where('id', user.id).update({ avatarUrl: result.url })
      }
      return response.ok({ success: true, path: result.key, key: result.key, url: result.url, setAvatar })
    } catch {
      return response.internalServerError({ error: 'upload_failed' })
    }
  }
}
