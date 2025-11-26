import type { HttpContext } from '@adonisjs/core/http'
import ConnectorService from '#services/connector_service'

export default class UserConnectorsController {
  public async activate({ auth, params, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const svc = new ConnectorService()
      await svc.activateConnector(Number(user.id), String(params.key))
      return response.ok({ success: true })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
  public async deactivate({ auth, params, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const svc = new ConnectorService()
      await svc.deactivateConnector(Number(user.id), String(params.key))
      return response.ok({ success: true })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}

