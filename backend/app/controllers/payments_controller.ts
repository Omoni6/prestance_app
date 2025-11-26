import type { HttpContext } from '@adonisjs/core/http'

export default class PaymentsController {
  public async createCheckout({ auth, request, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const moduleKey = String(request.input('module') || '')
      const billing = String(request.input('billing') || 'monthly')
      return response.ok({ success: true, module: moduleKey, billing })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async handleWebhook({ request, response }: HttpContext) {
    const payload = request.raw() || ''
    return response.ok({ received: !!payload })
  }

  public async getCurrentSubscription({ auth, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      return response.ok({ subscription: null })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}

