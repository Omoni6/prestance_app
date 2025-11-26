import type { HttpContext } from '@adonisjs/core/http'

export default class WebhooksController {
  public async dispatch({ request, response }: HttpContext) {
    const events = request.input('events') || []
    return response.ok({ success: true, dispatched: events.length })
  }
}

