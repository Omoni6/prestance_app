import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import ModuleService from '#services/module_service'

export default class ModulesController {
  public async list({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const svc = new ModuleService()
      const modules = await svc.listModules(Number(user.id))
      return response.ok({ modules })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async activate({ auth, request, response }: HttpContext) {
    const user = await auth.use('api').authenticate()
    const moduleKey = String(request.input('module')).trim()
    const svc = new ModuleService()
    await svc.activateModule(Number(user.id), moduleKey)
    return response.ok({ success: true })
  }

  public async deactivate({ auth, request, response }: HttpContext) {
    const user = await auth.use('api').authenticate()
    const moduleKey = String(request.input('module')).trim()
    const svc = new ModuleService()
    await svc.deactivateModule(Number(user.id), moduleKey)
    return response.ok({ success: true })
  }

  public async getModuleConnectors({ request, response }: HttpContext) {
    const moduleKey = String(request.input('module')).trim()
    return response.ok({ module: moduleKey, connectors: [] })
  }
  public async userStats({ params, auth, response }: HttpContext) {
    const user = await auth.use('api').authenticate()
    const requestedId = Number(params.id)
    if (!requestedId || requestedId !== Number(user.id)) {
      return response.forbidden({ error: 'Forbidden' })
    }

    const row = await db
      .from('modules')
      .where('user_id', user.id)
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('SUM(CASE WHEN active = true THEN 1 ELSE 0 END) as active'),
        db.raw('SUM(CASE WHEN expired = true THEN 1 ELSE 0 END) as expired')
      )
      .first()

    const stats = {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      expired: Number(row?.expired ?? 0),
    }

    return response.ok({
      stats,
      summary: { total: stats.total },
    })
  }

  public async userModules({ request, response }: HttpContext) {
    const email = String(request.qs().email || '').trim().toLowerCase()
    if (!email) return response.badRequest({ error: 'email_required' })

    const userRow: any = await db.from('users').whereRaw('LOWER(email) = ?', [email]).select('id', 'modules').first()
    if (!userRow?.id) return response.ok({ modules: [] })

    const canonical = (raw: string): string => {
      const s = (raw || '').toString().trim().toLowerCase()
      if (s === 'connecte' || s === 'commercial') return 'commercial'
      if (s === 'planifie' || s === 'plannifie' || s === 'planifi') return 'planifi'
      if (s === 'create' || s === 'crée' || s === 'cree') return 'cree'
      if (s === 'publie' || s === 'publish') return 'publie'
      return s
    }

    const rows: any[] = await db
      .from('user_modules')
      .join('modules', 'user_modules.module_id', 'modules.id')
      .where('user_modules.user_id', userRow.id)
      .select('modules.name', 'user_modules.is_active')

    const modules = rows.map((r) => {
      const raw = String(r.name)
      const name = canonical(raw)
      const enabled = !!(r.is_active ?? true)
      return { module_name: name, enabled, is_active: enabled, status: enabled ? 'active' : 'inactive' }
    })

    return response.ok({ modules })
  }

  public async dbOverview({ auth, response }: HttpContext) {
    const user = await auth.use('api').authenticate()
    if (!user?.id) return response.unauthorized({ error: 'Unauthorized' })

    const tables = await db
      .from('information_schema.tables')
      .where('table_schema', 'public')
      .select('table_name')

    const results: Record<string, { count: number }> = {}
    for (const t of tables) {
      const name = (t as any).table_name as string
      try {
        const row = await db.from(name).count('* as c').first()
        results[name] = { count: Number((row as any)?.c ?? 0) }
      } catch {}
    }

    return response.ok({ tables: Object.keys(results), counts: results })
  }

  public async publicModules({ response }: HttpContext) {
    try {
      const rows: Array<{ id: number; name: string; slug?: string; icon?: string; description?: string }> = await db
        .from('modules')
        .select('id', 'name', 'slug', 'icon', 'description')

      const pricingRows: Array<{ key: string; price_monthly?: number }> = await db
        .from('pricing')
        .where('type', 'module')
        .select('key', 'price_monthly')

      const priceMap = new Map<string, number>(pricingRows.map((p) => [String(p.key).toLowerCase(), Number(p.price_monthly || 150)]))
      const canonical = (raw: string): string => {
        const s = String(raw || '').trim().toLowerCase()
        if (s === 'connecte' || s === 'commercial') return 'commercial'
        if (s === 'planifie' || s === 'plannifie' || s === 'planifi') return 'planifi'
        if (s === 'create' || s === 'crée' || s === 'cree') return 'cree'
        if (s === 'publie' || s === 'publish') return 'publie'
        return s
      }

      const modules = rows.map((m) => {
        const slug = canonical(m.slug || m.name)
        return {
          slug,
          name: m.name,
          description: m.description || '',
          price_monthly: priceMap.get(slug) || 150,
          icon: m.icon || `${slug}.webp`,
        }
      })

      return response.ok({ modules })
    } catch {
      return response.ok({ modules: [] })
    }
  }
}
