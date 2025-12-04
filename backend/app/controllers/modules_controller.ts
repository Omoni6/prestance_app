import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import ModuleService from '#services/module_service'

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 400): Promise<T> {
  let last: any
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e: any) {
      last = e
      const msg = String((e && e.message) || e)
      const code = (e && e.code) || ''
      if (msg.includes('ECONNRESET') || String(code).toUpperCase() === 'ECONNRESET') {
        await sleep(delayMs + i * 200)
        continue
      }
      throw e
    }
  }
  throw last
}

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
    try {
      const emailParam = request.input('email') ?? (request.qs() as any)?.email
      const email = String(emailParam || '').trim().toLowerCase()
      if (!email) return response.badRequest({ error: 'email_required' })

      const user: any = await withRetry(() => db
        .from('users')
        .whereRaw('LOWER(email) = ?', [email])
        .select('id')
        .first())

      if (!user?.id) return response.ok({ user_id: null, email, modules: [] })

      const allModules: Array<{ id: number; name: string }> = await withRetry(() => db
        .from('modules')
        .select('id', 'name')
        .orderBy('name', 'asc'))

      // Detect column shape for user_modules
      const colsRes: any = await withRetry(() => db
        .from('information_schema.columns')
        .where('table_schema', 'public')
        .andWhere('table_name', 'user_modules')
        .select('column_name'))

      const cols = new Set<string>((colsRes || []).map((r: any) => String(r.column_name)))

      let modules: Array<{ id: string; module_name: string; display_name: string; is_active: boolean }> = []
      if (cols.has('module_id')) {
        const activeRows: Array<{ module_id: number }> = await withRetry(() => db
          .from('user_modules')
          .where('user_id', user.id)
          .select('module_id'))
        const activeSet = new Set<string>((activeRows || []).map((r) => String(r.module_id)))
        modules = (allModules || []).map((m) => ({
          id: String(m.id),
          module_name: String(m.name),
          display_name: String(m.name),
          is_active: activeSet.has(String(m.id)),
        }))
      } else if (cols.has('module_key')) {
        const canonical = (raw: string): string => {
          const s = (raw || '').toString().trim().toLowerCase()
          if (s === 'connecte' || s === 'commercial') return 'commercial'
          if (s === 'planifie' || s === 'plannifie' || s === 'planifi') return 'planifi'
          if (s === 'create' || s === 'crée' || s === 'cree') return 'cree'
          if (s === 'publie' || s === 'publish') return 'publie'
          return s
        }
        const activeRows: Array<{ module_key: string }> = await withRetry(() => db
          .from('user_modules')
          .where('user_id', user.id)
          .select('module_key'))
        const activeSet = new Set<string>((activeRows || []).map((r) => canonical(String(r.module_key))))
        modules = (allModules || []).map((m) => {
          const slug = canonical(String(m.name))
          return {
            id: String(m.id),
            module_name: String(m.name),
            display_name: String(m.name),
            is_active: activeSet.has(slug),
          }
        })
      } else {
        // Fallback: no known columns, return all inactive
        modules = (allModules || []).map((m) => ({
          id: String(m.id),
          module_name: String(m.name),
          display_name: String(m.name),
          is_active: false,
        }))
      }

      return response.ok({ user_id: user.id, email, modules })
    } catch (error) {
      return response.ok({ user_id: null, email: String((request.input('email') ?? (request.qs() as any)?.email) || '').trim().toLowerCase(), modules: [], error: 'modules_fetch_failed', details: (error as any)?.message || 'unknown' })
    }
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
      const rows: Array<{ id: number; name: string }> = await db
        .from('modules')
        .select('id', 'name')

      let priceMap = new Map<string, number>()
      try {
        const pricingRows: Array<{ key: string; price_monthly?: number }> = await db
          .from('pricing')
          .where('type', 'module')
          .select('key', 'price_monthly')
        priceMap = new Map<string, number>(pricingRows.map((p) => [String(p.key).toLowerCase(), Number(p.price_monthly || 150)]))
      } catch {
        priceMap = new Map<string, number>()
      }
      const canonical = (raw: string): string => {
        const s = String(raw || '').trim().toLowerCase()
        if (s === 'connecte' || s === 'commercial') return 'commercial'
        if (s === 'planifie' || s === 'plannifie' || s === 'planifi') return 'planifi'
        if (s === 'create' || s === 'crée' || s === 'cree') return 'cree'
        if (s === 'publie' || s === 'publish') return 'publie'
        return s
      }

      const modulesRaw = rows.map((m) => {
        const slug = canonical(m.name)
        const moduleIcon = (['planifi','cree','publie','commercial'].includes(slug) ? `${slug}.webp` : `${slug}.png`)
        return {
          slug,
          name: m.name,
          description: '',
          price_monthly: priceMap.get(slug) || 150,
          icon: moduleIcon,
        }
      })
      const modules = Array.from(new Map(modulesRaw.map((mm) => [String(mm.slug).toLowerCase(), mm])).values())
      return response.ok({ modules })
    } catch {
      return response.ok({ modules: [] })
    }
  }
}
