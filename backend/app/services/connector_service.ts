import db from '@adonisjs/lucid/services/db'

export default class ConnectorService {
  async listByModule(userId: number, moduleKey: string) {
    const mapRows = await db.from('module_connectors').where({ module_key: moduleKey }).select('connector_code', 'included').catch(() => [])
    const codes = (mapRows as any[]).map((r) => String(r.connector_code))
    const connectors = codes.length ? await db.from('connectors').whereIn('code', codes).select('code', 'name', 'is_premium').catch(() => []) : []
    const userCons = await db.from('user_connectors').where({ user_id: userId }).select('connector_code').catch(() => [])
    const uSet = new Set<string>(userCons.map((r: any) => String(r.connector_code)))
    const included: any[] = []
    const premium: any[] = []
    for (const c of connectors as any[]) {
      const isPremium = !!c.is_premium
      const connected = uSet.has(String(c.code))
      const entry = { code: String(c.code), name: String(c.name), connected }
      if (isPremium) premium.push(entry)
      else included.push(entry)
    }
    return { included, premium }
  }

  async activateConnector(userId: number, connectorKey: string) {
    try {
      await db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [userId, connectorKey])
    } catch {}
    return { success: true }
  }
  async deactivateConnector(userId: number, connectorKey: string) {
    try {
      await db.from('user_connectors').where({ user_id: userId, connector_code: connectorKey }).delete()
    } catch {}
    return { success: true }
  }
}
