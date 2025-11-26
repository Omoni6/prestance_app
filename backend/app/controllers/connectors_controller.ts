import type { HttpContext } from '@adonisjs/core/http'
import ConnectorService from '#services/connector_service'
import db from '@adonisjs/lucid/services/db'

export default class ConnectorsController {
  public async list({ response }: HttpContext) {
    const rows: any = await db.rawQuery("SELECT code FROM connectors")
    const connectors = (rows?.rows || []).map((r: any) => ({ code: String(r.code), name: String(r.code) }))
    return response.ok({ connectors })
  }

  public async listPremium({ response }: HttpContext) {
    return response.ok({ connectors: [] })
  }

  public async activate({ auth, request, response }: HttpContext) {
    const user = await auth.use('api').authenticate()
    const connectorKey = String(request.input('connector') || request.params().key || '').trim()
    const svc = new ConnectorService()
    await svc.activateConnector(Number(user.id), connectorKey)
    return response.ok({ success: true, connector: connectorKey })
  }

  public async deactivate({ auth, request, response }: HttpContext) {
    const user = await auth.use('api').authenticate()
    const connectorKey = String(request.input('connector') || request.params().key || '').trim()
    const svc = new ConnectorService()
    await svc.deactivateConnector(Number(user.id), connectorKey)
    return response.ok({ success: true, connector: connectorKey })
  }

  public async listByModule({ auth, params, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const svc = new ConnectorService()
      const { included, premium } = await svc.listByModule(Number(user.id), String(params.key))
      return response.ok({ included, premium })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async redirect({ params, ally, response }: HttpContext) {
    const key = String(params.key)
    if (key === 'calendar' || key === 'google') {
      return ally.use('google').redirect()
    }
    if (key === 'slack') {
      try { return ally.use('slack' as any).redirect() } catch {}
    }
    return response.badRequest({ error: 'unknown_provider' })
  }

  public async callback({ params, ally, response }: HttpContext) {
    const key = String(params.key)
    const provider = key === 'calendar' ? 'google' : key
    try {
      const driver = ally.use(provider as any)
      if (driver.accessDenied()) return response.unauthorized({ error: 'access_denied' })
      const user = await driver.user()
      return response.ok({ provider, user })
    } catch (e) {
      return response.badRequest({ error: 'callback_failed', provider })
    }
  }
}
