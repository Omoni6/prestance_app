import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class PublishingController {
  public async prepareCalendar({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const durationDays = Number(request.input('durationDays') || 7)
      const axes = String(request.input('axes') || '')
      const subject = String(request.input('subject') || '')
      const product = String(request.input('product') || '')
      const photoSource = String(request.input('photoSource') || '')
      const extras = request.input('extras') || {}
      if (!subject) return response.badRequest({ error: 'subject_required' })
      const payload = { user_id: Number(user.id), durationDays, axes, subject, product, photoSource, extras }
      const ins = await db.raw('INSERT INTO outbox (type, target, payload_json, status, created_at) VALUES (?, ?, ?, ?, NOW()) RETURNING id', ['publishing.calendar.prepare', 'publie', JSON.stringify(payload), 'pending'])
      const id = Number((ins as any)?.rows?.[0]?.id || 0)
      return response.ok({ queued: true, job_id: id })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}
