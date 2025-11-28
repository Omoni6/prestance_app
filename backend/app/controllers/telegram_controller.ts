import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

function env(key: string, fallback = '') { const v = process.env[key]; return typeof v === 'string' && v.length ? v : fallback }

export default class TelegramController {
  public async webhook({ request, response }: HttpContext) {
    try {
      const body = request.body()
      await db.raw('INSERT INTO webhooks_logs (source, payload, created_at) VALUES (?, ?, NOW())', ['telegram', JSON.stringify(body)])
      return response.ok({ ok: true })
    } catch { return response.badRequest({ ok: false }) }
  }

  public async setWebhook({ response }: HttpContext) {
    try {
      const token = env('TELEGRAM_BOT_TOKEN_OMONI') || env('TELEGRAM_BOT_TOKEN_OMANAGER')
      const base = env('BACKEND_URL')
      const url = `${base}/api/v1/telegram/webhook`
      const resp = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const j = await resp.json()
      return response.ok(j)
    } catch { return response.badRequest({ ok: false }) }
  }

  public async getWebhookInfo({ response }: HttpContext) {
    try {
      const token = env('TELEGRAM_BOT_TOKEN_OMONI') || env('TELEGRAM_BOT_TOKEN_OMANAGER')
      const resp = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
      const j = await resp.json()
      return response.ok(j)
    } catch { return response.badRequest({ ok: false }) }
  }

  public async getUpdates({ response }: HttpContext) {
    try {
      const token = env('TELEGRAM_BOT_TOKEN_OMONI') || env('TELEGRAM_BOT_TOKEN_OMANAGER')
      const resp = await fetch(`https://api.telegram.org/bot${token}/getUpdates`)
      const j = await resp.json()
      return response.ok(j)
    } catch { return response.badRequest({ ok: false }) }
  }
}

