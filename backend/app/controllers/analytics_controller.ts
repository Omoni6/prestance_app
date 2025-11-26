import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class AnalyticsController {
  public async summary({ auth, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      return response.ok({ summary: { events: 0 } })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async events({ auth, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      return response.ok({ events: [] })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async stats({ auth, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      let tasksActive = 0
      let tasksCompleted = 0
      let projectsActive = 0
      let projectsArchived = 0
      try {
        const t1: any = await db.rawQuery("SELECT COUNT(*) AS c FROM tasks WHERE status <> 'done'")
        const t2: any = await db.rawQuery("SELECT COUNT(*) AS c FROM tasks WHERE status = 'done'")
        tasksActive = Number(t1?.rows?.[0]?.c ?? 0)
        tasksCompleted = Number(t2?.rows?.[0]?.c ?? 0)
      } catch {}
      try {
        const p1: any = await db.rawQuery("SELECT COUNT(*) AS c FROM projects WHERE archived IS NOT TRUE")
        const p2: any = await db.rawQuery("SELECT COUNT(*) AS c FROM projects WHERE archived IS TRUE")
        projectsActive = Number(p1?.rows?.[0]?.c ?? 0)
        projectsArchived = Number(p2?.rows?.[0]?.c ?? 0)
      } catch {}
      return response.ok({ tasks: { active: tasksActive, completed: tasksCompleted }, projects: { active: projectsActive, archived: projectsArchived } })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}
