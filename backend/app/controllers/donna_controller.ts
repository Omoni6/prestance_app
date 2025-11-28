import type { HttpContext } from '@adonisjs/core/http'
import Env from '#start/env'

export default class DonnaController {
  public async chat({ auth, request, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return response.badRequest({ error: 'missing_openai_api_key' })
      const text = String(request.input('message') || '').trim()
      if (!text) return response.badRequest({ error: 'message_required' })
      const sys = String(Env.get('DONNA_SYSTEM_PROMPT') || '')
      const instructions = String(request.input('instructions') || sys || 'Tu es Donna, assistant utile et fiable. Réponds de manière concise et actionnable.')
      const payload = {
        model: 'gpt-4o-mini',
        input: [
          { role: 'system', content: instructions },
          { role: 'user', content: text },
        ],
      }
      const resp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        const txt = await resp.text()
        const fallback = 'Message reçu — notre équipe vous répond sous 2–4h.'
        return response.ok({ reply: fallback, error: 'openai_error', detail: txt })
      }
      const data: any = await resp.json()
      const out = String(data?.output_text || data?.choices?.[0]?.message?.content || '')
      return response.ok({ reply: out })
    } catch (err) {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async receiveConsultation({ request, response }: HttpContext) {
    try {
      const data = request.body()
      try {
        const db = (await import('@adonisjs/lucid/services/db')).default
        await db.raw('INSERT INTO outbox (type, target, payload_json, status, created_at) VALUES (?, ?, ?, ?, NOW())', ['consultation.request', 'admin', JSON.stringify(data), 'pending'])
      } catch {}
      try {
        const { default: MailService } = await import('#services/mail_service')
        const ms = new MailService()
        const to = process.env.SMTP_USER || 'contact@omoniprestanceholding.com'
        const subject = `Nouvelle consultation: ${String(data?.fullName||'client')}`
        const text = `Demande de consultation:\n${JSON.stringify(data, null, 2)}`
        await ms.send(to, subject, text)
      } catch {}
      return response.ok({ success: true })
    } catch {
      return response.badRequest({ error: 'invalid_payload' })
    }
  }

  public async processDocument({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const key = String(request.input('key') || '').trim()
      const action = String(request.input('action') || 'analyze').trim()
      if (!key) return response.badRequest({ error: 'key_required' })
      const payload = { user_id: Number(user.id), key, action }
      const { default: db } = await import('@adonisjs/lucid/services/db')
      const ins = await db.raw('INSERT INTO outbox (type, target, payload_json, status, created_at) VALUES (?, ?, ?, ?, NOW()) RETURNING id', ['document.process', 'donna', JSON.stringify(payload), 'pending'])
      const id = Number((ins as any)?.rows?.[0]?.id || 0)
      return response.ok({ queued: true, job_id: id })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}
