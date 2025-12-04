import type { HttpContext } from '@adonisjs/core/http'
import ConnectorService from '#services/connector_service'

export default class UserConnectorsController {
  public async activate({ auth, params, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const key = String(request.input('connector') || params.key || '').trim()
      if (!key) return response.badRequest({ error: 'connector_required' })
      const svc = new ConnectorService()
      await svc.activateConnector(Number(user.id), key)
      return response.ok({ success: true, connector: key })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async deactivate({ auth, params, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const key = String(request.input('connector') || params.key || '').trim()
      if (!key) return response.badRequest({ error: 'connector_required' })
      const svc = new ConnectorService()
      await svc.deactivateConnector(Number(user.id), key)
      return response.ok({ success: true, connector: key })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}
