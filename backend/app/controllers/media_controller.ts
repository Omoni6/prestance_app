import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class MediaController {
  public async createImage({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const prompt = String(request.input('prompt') || '').trim()
      if (!prompt) return response.badRequest({ error: 'prompt_required' })
      const payload = { user_id: user.id, kind: 'image', connector: 'nano_banana', provider_pref: ['gemini-3-pro-image-preview'], prompt }
      const ins = await db.raw('INSERT INTO outbox (type, target, payload_json, status, created_at) VALUES (?, ?, ?, ?, NOW()) RETURNING id', ['media.generate', 'image', JSON.stringify(payload), 'pending'])
      const id = Number((ins as any)?.rows?.[0]?.id || 0)
      return response.ok({ queued: true, job_id: id })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async createVideo({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const prompt = String(request.input('prompt') || '').trim()
      if (!prompt) return response.badRequest({ error: 'prompt_required' })
      const payload = { user_id: user.id, kind: 'video', connector: 'sora2', provider_pref: ['openai.sora2','veo3','wan.video'], prompt, fallback: 'manual_notif' }
      const ins = await db.raw('INSERT INTO outbox (type, target, payload_json, status, created_at) VALUES (?, ?, ?, ?, NOW()) RETURNING id', ['media.generate', 'video', JSON.stringify(payload), 'pending'])
      const id = Number((ins as any)?.rows?.[0]?.id || 0)
      return response.ok({ queued: true, job_id: id })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}

