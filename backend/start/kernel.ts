import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'
import db from '@adonisjs/lucid/services/db'

server.errorHandler(() => import('#exceptions/handler'))

/**
 * Server global middleware (always executed)
 */
server.use([
  () => import('@adonisjs/cors/cors_middleware'),
])

/**
 * Router middleware
 */
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),    
  () => import('@adonisjs/auth/initialize_auth_middleware'),
])

/**
 * Named middleware
 */
export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
})

;(async () => {
  try {
    const tables = await db
      .from('information_schema.tables')
      .where('table_schema', 'public')
      .select('table_name')

    const overview: Record<string, number> = {}
    for (const t of tables) {
      const name = (t as any).table_name as string
      try {
        const row = await db.from(name).count('* as c').first()
        overview[name] = Number((row as any)?.c ?? 0)
      } catch {
        overview[name] = -1
      }
    }
    console.info('🔎 DB overview:', overview)
  } catch (err) {
    console.error('DB overview failed', err)
  }
  try {
    const { default: CronService } = await import('#services/cron_service')
    const cron = new CronService()
    await cron.start()
    console.info('⏱️ Cron service started')
  } catch (err) {
    console.error('Cron service failed to start', err)
  }
})()
