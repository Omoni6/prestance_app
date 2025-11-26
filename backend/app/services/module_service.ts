import db from '@adonisjs/lucid/services/db'

type ModuleRow = { id: number; name: string; description?: string; slug?: string; icon?: string; connectors_included?: any; connectors_premium?: any }
type ConnectorRow = { id: number; code: string; name: string; is_premium?: boolean }
type ConnectorEntry = { code: string; name: string; icon?: string; connected?: boolean }

function canonical(raw: string) {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'connecte' || s === 'commercial') return 'commercial'
  if (s === 'planifie' || s === 'plannifie' || s === 'planifi') return 'planifi'
  if (s === 'create' || s === 'crée' || s === 'cree') return 'cree'
  if (s === 'publie' || s === 'publish') return 'publie'
  return s
}

export default class ModuleService {
  async listModules(userId: number) {
    const modules: ModuleRow[] = await db
      .from('modules')
      .select('id', 'name', 'description', 'slug', 'icon', 'connectors_included', 'connectors_premium')
      .catch(() => [])
    const activeRows = await db
      .from('user_modules')
      .join('modules', 'user_modules.module_id', 'modules.id')
      .where('user_modules.user_id', userId)
      .select('modules.name', 'user_modules.is_active')
      .catch(() => [])
    const activeSet = new Set<string>(activeRows.filter((r: any) => !!(r.is_active ?? true)).map((r: any) => canonical(r.name)))

    const pricingRows = await db.from('pricing').where('type', 'module').select('key', 'price_monthly').catch(() => [])
    const priceMap = new Map<string, number>(pricingRows.map((p: any) => [String(p.key), Number(p.price_monthly || 150)]))

    let mcon: any[] = []
    let connectors: any[] = []
    let userCons: any[] = []
    try {
      mcon = (await db.rawQuery('SELECT mc.module_id, mc.connector_id, mc.included, mc.type, m.name AS module_name, c.code AS connector_code FROM module_connectors mc JOIN modules m ON mc.module_id = m.id JOIN connectors c ON mc.connector_id = c.id')).rows || []
    } catch {
      try {
        mcon = (await db.rawQuery('SELECT mc.module_key AS module_name, mc.connector_code, mc.included, mc.type FROM module_connectors mc')).rows || []
      } catch { mcon = [] }
    }
    try {
      connectors = (await db.rawQuery('SELECT id, code FROM connectors')).rows || []
    } catch { connectors = [] }
    try {
      userCons = (await db.rawQuery('SELECT uc.connector_id, c.code AS connector_code FROM user_connectors uc JOIN connectors c ON uc.connector_id = c.id WHERE uc.user_id = $1', [userId])).rows || []
    } catch {
      try {
        userCons = (await db.rawQuery('SELECT connector_code FROM user_connectors WHERE user_id = $1', [userId])).rows || []
      } catch { userCons = [] }
    }
    const uSet = new Set<string>(userCons.map((r: any) => String(r.connector_code || r.connector_id)))
    const connMap = new Map<string, ConnectorRow>(connectors.map((c: any) => [String(c.code), { id: c.id, code: String(c.code), name: String(c.code), is_premium: false }]))

    const grouped: Record<string, { included: ConnectorEntry[]; premium: ConnectorEntry[] }> = {}
    for (const row of mcon as any[]) {
      const mk = canonical(String(row.module_name || row.module_key))
      const cc = String(row.connector_code)
      const t = String(row.type || '').toLowerCase()
      const inc = row.hasOwnProperty('included') ? !!row.included : (t ? t !== 'premium' : true)
      const c = connMap.get(cc)
      if (!c) continue
      if (!grouped[mk]) grouped[mk] = { included: [], premium: [] }
      const base: ConnectorEntry = { code: c.code, name: c.name || c.code, icon: `/icons/${c.code}.png`, connected: uSet.has(c.code) }
      if (inc) grouped[mk].included.push(base)
      else grouped[mk].premium.push(base)
    }

    // Override with new module columns if present
    for (const m of modules) {
      const key = canonical(m.slug || m.name)
      const incRaw = m.connectors_included
      const premRaw = m.connectors_premium
      const parseList = (v: any): string[] => {
        if (!v) return []
        if (Array.isArray(v)) return v.map((x) => String(x))
        try {
          const j = JSON.parse(String(v))
          return Array.isArray(j) ? j.map((x) => String(x)) : []
        } catch { return [] }
      }
      const inc = parseList(incRaw)
      const prem = parseList(premRaw)
      if (inc.length || prem.length) {
        if (!grouped[key]) grouped[key] = { included: [], premium: [] }
        grouped[key].included = inc.map((code) => ({ code, name: code, icon: `/icons/${code}.png`, connected: uSet.has(code) }))
        grouped[key].premium = prem.map((code) => ({ code, name: code, icon: `/icons/${code}.png`, connected: uSet.has(code) }))
      }
    }

    // Fallback mapping when database lacks module_connector entries
    const defaults: Record<string, { included: string[]; premium: string[] }> = {
      planifi: { included: ['omoni_calendar','telegram','slack'], premium: ['gmail','calendly','smtp','google_calendar'] },
      cree: { included: ['omoni_bucket','telegram','slack','nano_banana','sora2'], premium: ['suno','elevenlabs','notion','canva'] },
      publie: { included: ['omoni_bucket','blotato'], premium: ['ticketmaster','n8n','spotify'] },
      commercial: { included: ['omoni_crm','telegram','slack','omoni_calendar','hubspot'], premium: ['salesforce','whatsapp_business','twilio','lemonsqueezy'] },
    }
    for (const key of Object.keys(defaults)) {
      if (!grouped[key]) grouped[key] = { included: [], premium: [] }
      if (grouped[key].included.length === 0) {
        grouped[key].included = defaults[key].included.map((code) => ({ code, name: code, icon: `/icons/${code}.png`, connected: uSet.has(code) }))
      }
      if (grouped[key].premium.length === 0) {
        grouped[key].premium = defaults[key].premium.map((code) => ({ code, name: code, icon: `/icons/${code}.png`, connected: uSet.has(code) }))
      }
    }

    const premiumAll: any[] = []

    const raw = modules.map((m) => {
      const key = canonical(m.slug || m.name)
      return {
        key,
        name: m.name,
        slug: m.slug || key,
        icon: m.icon || '',
        description: m.description || '',
        active: activeSet.has(key),
        price_monthly: priceMap.get(key) || 150,
        connectors: grouped[key]
          ? { included: grouped[key].included, premium: grouped[key].premium.length ? grouped[key].premium : premiumAll }
          : { included: [], premium: premiumAll },
      }
    })
    const unique: Record<string, any> = {}
    for (const r of raw) {
      unique[r.key] = unique[r.key] || r
      // merge connectors if duplicates found
      if (unique[r.key] !== r) {
        const inc = unique[r.key].connectors.included
        const prem = unique[r.key].connectors.premium
        for (const c of r.connectors.included) if (!inc.find((x: any) => x.code === c.code)) inc.push(c)
        for (const c of r.connectors.premium) if (!prem.find((x: any) => x.code === c.code)) prem.push(c)
        unique[r.key].active = unique[r.key].active || r.active
      }
    }
    return Object.values(unique)
  }

  async activateModule(userId: number, moduleKey: string) {
    const key = canonical(moduleKey)
    const mod: any = await db.from('modules').whereRaw('LOWER(name) = ?', [key]).select('id').first().catch(() => null)
    if (!mod?.id) return { success: false }
    try {
      await db.raw('INSERT INTO user_modules (user_id, module_id, is_active) VALUES (?, ?, true) ON CONFLICT DO NOTHING', [userId, mod.id])
    } catch {}
    await this.autoActivateIncludedConnectors(userId, key)
    return { success: true }
  }

  async deactivateModule(userId: number, moduleKey: string) {
    const key = canonical(moduleKey)
    const mod: any = await db.from('modules').whereRaw('LOWER(name) = ?', [key]).select('id').first().catch(() => null)
    if (!mod?.id) return { success: false }
    try {
      await db.from('user_modules').where({ user_id: userId, module_id: mod.id }).delete()
    } catch {}
    try {
      await db.raw('DELETE FROM user_connectors WHERE user_id = ? AND connector_code IN (SELECT connector_code FROM module_connectors WHERE module_key = ? AND is_premium = true)', [userId, key])
    } catch {}
    return { success: true }
  }

  async autoActivateIncludedConnectors(userId: number, moduleKey: string) {
    try {
      const rows = await db.from('module_connectors').where({ module_key: moduleKey }).select('connector_code', 'included')
      for (const r of rows as any[]) {
        const code = String(r.connector_code)
        const included = !!r.included
        if (included) {
          await db.raw('INSERT INTO user_connectors (user_id, connector_code) VALUES (?, ?) ON CONFLICT DO NOTHING', [userId, code])
        }
      }
    } catch {}
    return { success: true }
  }
}
