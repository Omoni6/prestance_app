import type { HttpContext } from '@adonisjs/core/http'
import Env from '#start/env'

export default class SlackEventsController {
  private async verifySignature(request: HttpContext['request']): Promise<boolean> {
    try {
      const secret = String(Env.get('SLACK_SIGNING_SECRET') || '')
      if (!secret) return true
      const ts = String(request.header('X-Slack-Request-Timestamp') || '')
      const sig = String(request.header('X-Slack-Signature') || '')
      if (!ts || !sig) return false
      // Slack requires HMAC-SHA256 of `v0:${ts}:${rawBody}` with secret, prefixed by `v0=`
      const raw = JSON.stringify(request.all())
      const crypto = await import('node:crypto')
      const h = crypto.createHmac('sha256', secret).update(`v0:${ts}:${raw}`).digest('hex')
      const expected = `v0=${h}`
      return expected === sig
    } catch {
      return false
    }
  }

  public async events({ request, response }: HttpContext) {
    try {
      // URL verification
      const type = String((request.input('type') || '')).toLowerCase()
      if (type === 'url_verification') {
        const challenge = String(request.input('challenge') || '')
        return response.ok({ challenge })
      }

      // Signature
      const ok = await this.verifySignature(request)
      if (!ok) return response.unauthorized({ error: 'invalid_signature' })

      const ev = request.input('event') || {}
      const subtype = String(ev.subtype || '')
      const isBot = !!ev.bot_id
      const text = String(ev.text || '')
      const channel = String(ev.channel || '')
      if (!channel || !text || isBot || subtype === 'message_changed') return response.ok({ ignored: true })

      // Build a reply via OpenAI (same logic as donna_controller)
      const apiKey = String(Env.get('OPENAI_API_KEY') || '')
      const system = String(Env.get('DONNA_SYSTEM_PROMPT') || 'Tu es Donna, assistante commerciale et administrative.')
      let reply = '…'
      if (apiKey && text) {
        try {
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.6, messages: [ { role: 'system', content: system }, { role: 'user', content: text } ] })
          })
          const j: any = await r.json()
          reply = String(j?.choices?.[0]?.message?.content || 'Reçu. Je m’en occupe.')
        } catch {
          reply = 'Message reçu. (OpenAI indisponible)'
        }
      }

      // Post reply to Slack via bot token
      const botToken = String(Env.get('SLACK_BOT_TOKEN') || '')
      if (botToken) {
        try {
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel, text: reply })
          })
        } catch {}
      }

      return response.ok({ success: true })
    } catch {
      return response.internalServerError({ error: 'slack_events_failed' })
    }
  }
}
