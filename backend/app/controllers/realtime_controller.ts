import type { HttpContext } from '@adonisjs/core/http'
import Env from '#start/env'

export default class RealtimeController {
  public async clientSecret({ request, response }: HttpContext) {
    try {
      const apiKey = Env.get('OPENAI_API_KEY')
      if (!apiKey) return response.badRequest({ error: 'missing_openai_api_key' })
      console.log('realtime: OPENAI key present')
      const voice = String(request.input('voice') || request.qs().voice || 'verse')
      const instructions = String(request.input('instructions') || '').trim()
      const body = {
        session: {
          type: 'realtime',
          model: 'gpt-4o-realtime-preview-2024-12-17',
          audio: { output: { voice } },
          instructions: instructions || undefined,
        },
      }
      const resp = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        const txt = await resp.text()
        return response.badRequest({ error: 'openai_error', detail: txt })
      }
      const data: any = await resp.json()
      console.log('realtime: secret generated for model', body.session.model, 'voice', voice, instructions ? 'with_instructions' : 'no_instructions')
      return response.ok({ value: data.value })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}
