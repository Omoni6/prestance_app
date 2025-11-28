import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class AdminController {
  public async overview({ auth, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const usersRows: any = await db.rawQuery('SELECT COUNT(*) AS c FROM users')
      const connectorsRows: any = await db.rawQuery('SELECT COUNT(*) AS c FROM user_connectors')
      const deliveriesRows: any = await db.rawQuery('SELECT COUNT(*) AS c FROM project_deliveries')
      const tasksRows: any = await db.rawQuery("SELECT COUNT(*) AS c FROM tasks WHERE status='todo'")
      const outboxPendingRows: any = await db.rawQuery("SELECT COUNT(*) AS c FROM outbox WHERE status='pending'")
      const outboxQueuedRows: any = await db.rawQuery("SELECT COUNT(*) AS c FROM outbox WHERE status='queued'")
      const outboxSentRows: any = await db.rawQuery("SELECT COUNT(*) AS c FROM outbox WHERE status='sent'")
      const counts = {
        users: Number(usersRows.rows?.[0]?.c || 0),
        connectors: Number(connectorsRows.rows?.[0]?.c || 0),
        deliveries: Number(deliveriesRows.rows?.[0]?.c || 0),
        tasks: Number(tasksRows.rows?.[0]?.c || 0),
        outbox_pending: Number(outboxPendingRows.rows?.[0]?.c || 0),
        outbox_queued: Number(outboxQueuedRows.rows?.[0]?.c || 0),
        outbox_sent: Number(outboxSentRows.rows?.[0]?.c || 0),
      }
      return response.ok({ counts })
    } catch { return response.unauthorized({ error: 'unauthenticated' }) }
  }
  public async subscribers({ auth, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const rows = await db.from('newsletter_subscribers').select('*').orderBy('created_at','desc')
      return response.ok({ subscribers: rows })
    } catch { return response.unauthorized({ error: 'unauthenticated' }) }
  }
  public async outbox({ auth, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const rows = await db.from('outbox').select('*').orderBy('created_at','desc').limit(50)
      return response.ok({ outbox: rows })
    } catch { return response.unauthorized({ error: 'unauthenticated' }) }
  }

  public async endpoints({ auth, response }: HttpContext) {
    try {
      await auth.use('api').authenticate()
      const endpoints = [
        { method: 'POST', path: '/api/v1/realtime/client-secret' },
        { method: 'GET', path: '/api/v1/connectors/:key/redirect' },
        { method: 'GET', path: '/api/v1/connectors/:key/callback' },
        { method: 'POST', path: '/api/v1/connectors/:key/config' },
        { method: 'GET', path: '/api/v1/connectors' },
        { method: 'GET', path: '/api/v1/connectors/premium' },
        { method: 'POST', path: '/api/v1/connectors/activate' },
        { method: 'POST', path: '/api/v1/connectors/deactivate' },
        { method: 'POST', path: '/api/v1/media/image' },
        { method: 'POST', path: '/api/v1/media/video' },
        { method: 'GET', path: '/api/v1/projects/:id/deliveries' },
        { method: 'POST', path: '/api/v1/projects/:id/deliveries' },
        { method: 'DELETE', path: '/api/v1/projects/:id/deliveries/:deliveryId' },
        { method: 'GET', path: '/api/v1/deliveries' },
        { method: 'GET', path: '/api/v1/tasks' },
        { method: 'POST', path: '/api/v1/tasks/:id/update' },
        { method: 'POST', path: '/api/v1/meetings/notes/start' },
        { method: 'POST', path: '/api/v1/meetings/notes/:id/append' },
        { method: 'POST', path: '/api/v1/meetings/notes/:id/transcribe' },
        { method: 'POST', path: '/api/v1/meetings/notes/:id/finish' },
        { method: 'DELETE', path: '/api/v1/meetings/notes/:id' },
        { method: 'GET', path: '/api/v1/calendar/upcoming' },
        { method: 'GET', path: '/api/v1/newsletter/campaigns' },
        { method: 'POST', path: '/api/v1/newsletter/campaigns' },
        { method: 'POST', path: '/api/v1/newsletter/campaigns/:id/send' },
        { method: 'POST', path: '/api/v1/webhooks/dispatch' },
        { method: 'POST', path: '/api/v1/telegram/webhook' },
        { method: 'POST', path: '/api/v1/telegram/webhook/set' },
        { method: 'GET', path: '/api/v1/telegram/webhook/info' },
        { method: 'GET', path: '/api/v1/telegram/updates' },
      ]
      return response.ok({ endpoints })
    } catch { return response.unauthorized({ error: 'unauthenticated' }) }
  }
}
