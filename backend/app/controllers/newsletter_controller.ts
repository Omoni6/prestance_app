import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class NewsletterController {
  public async list({ auth, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const rows = await db.from('newsletter_campaigns').select('*').orderBy('created_at','desc')
      return response.ok({ campaigns: rows })
    } catch { return response.unauthorized({ error: 'unauthenticated' }) }
  }
  public async create({ auth, request, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const title = String(request.input('title') || '')
      const body_text = String(request.input('body_text') || '')
      const body_html = String(request.input('body_html') || '')
      const ins: any = await db.raw('INSERT INTO newsletter_campaigns (title, body_text, body_html, status, created_at) VALUES (?, ?, ?, ?, NOW()) RETURNING id', [title, body_text, body_html, 'draft'])
      return response.ok({ id: Number(ins?.rows?.[0]?.id || 0) })
    } catch { return response.unauthorized({ error: 'unauthenticated' }) }
  }
  public async send({ auth, params, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const id = Number(params.id)
      const row: any = await db.from('newsletter_campaigns').where('id', id).select('title','body_text','body_html').first()
      if (!row) return response.notFound({ error: 'campaign_not_found' })
      await db.raw('INSERT INTO outbox (type, target, payload_json, status, created_at) VALUES (?, ?, ?, ?, NOW())', ['newsletter.send', 'email', JSON.stringify({ campaign_id: id }), 'pending'])
      await db.from('newsletter_campaigns').where('id', id).update({ status: 'queued', updated_at: new Date() })
      return response.ok({ success: true })
    } catch { return response.unauthorized({ error: 'unauthenticated' }) }
  }
}

