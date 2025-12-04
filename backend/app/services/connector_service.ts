import db from '@adonisjs/lucid/services/db'

export default class ConnectorService {
  async listByModule(userId: number, moduleKey: string) {
    const mapRows = await db.from('module_connectors').where({ module_key: moduleKey }).select('connector_code', 'included').catch(() => [])
    const codes = (mapRows as any[]).map((r) => String(r.connector_code))
    const connectors = codes.length ? await db.from('connectors').whereIn('code', codes).select('code', 'name', 'is_premium').catch(() => []) : []
    const userCons = await db.from('user_connectors').where({ user_id: userId }).select('connector_code').catch(() => [])
    const norm = (s: string) => s.toLowerCase().replace(/-/g, '_')
    const uSet = new Set<string>(userCons.map((r: any) => norm(String(r.connector_code))) )
    const included: any[] = []
    const premium: any[] = []
    for (const c of connectors as any[]) {
      const isPremium = !!c.is_premium
      const code = String(c.code)
      const connected = uSet.has(norm(code))
      const entry = { code, name: String(c.name), connected }
      if (isPremium) premium.push(entry)
      else included.push(entry)
    }
    if (included.length === 0 && premium.length === 0) {
      const defaults: Record<string, { included: string[]; premium: string[] }> = {
        planifi: { included: ['omoni_calendar','telegram','slack'], premium: ['gmail','calendly','smtp','google_calendar','google_drive'] },
        cree: { included: ['omoni_bucket','telegram','slack','nano_banana','sora2'], premium: ['suno','elevenlabs','notion','canva','google_drive'] },
        publie: { included: ['omoni_bucket','blotato','telegram','slack'], premium: ['ticketmaster','n8n','spotify','google_drive'] },
        commercial: { included: ['omoni_crm','telegram','slack','omoni_calendar','hubspot','google_drive'], premium: ['salesforce','whatsapp_business','twilio','lemonsqueezy','google_drive'] },
      }
      const key = norm(moduleKey)
      const def = defaults[key] || { included: [], premium: [] }
      included.push(...def.included.map((code) => ({ code, name: code, connected: uSet.has(norm(code)) })))
      premium.push(...def.premium.map((code) => ({ code, name: code, connected: uSet.has(norm(code)) })))
    }
    return { included, premium }
  }

  async activateConnector(userId: number, connectorKey: string) {
    try {
      await db.raw(
        "INSERT INTO user_connectors (user_id, connector_code, enabled, activated_at, price) VALUES (?, ?, TRUE, NOW(), COALESCE(price, 0)) ON CONFLICT (user_id, connector_code) DO UPDATE SET enabled = TRUE, activated_at = NOW()",
        [userId, connectorKey]
      )
    } catch {}
    return { success: true }
  }
  async deactivateConnector(userId: number, connectorKey: string) {
    try {
      await db
        .from('user_connectors')
        .where({ user_id: userId, connector_code: connectorKey })
        .update({ enabled: false })
    } catch {}
    return { success: true }
  }
}
