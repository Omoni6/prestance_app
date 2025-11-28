import type { HttpContext } from '@adonisjs/core/http'
import OutboxDispatcher from '#services/outbox_dispatcher'

export default class WebhooksController {
  public async dispatch({ response }: HttpContext) {
    const d = new OutboxDispatcher()
    const res = await d.dispatchPending()
    return response.ok({ success: true, dispatched: res.dispatched })
  }
}
