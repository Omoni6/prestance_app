/*
|--------------------------------------------------------------------------
| Routes file — Version API v1
|--------------------------------------------------------------------------
*/

import router from '@adonisjs/core/services/router'
import env from '#start/env'
import { middleware } from '#start/kernel'
import db from '@adonisjs/lucid/services/db'

/* ---------------------------------------------------------
|   ROOT & HEALTH (non versionné)
--------------------------------------------------------- */

router.get('/', async () => ({
  message: 'Donna API is running!',
  version: '1.0.0',
  status: 'healthy',
}))

router.get('/api/v1/health', async () => ({ status: 'ok' }))

/* ---------------------------------------------------------
|   API v1 — TOUTE TON API ICI
--------------------------------------------------------- */

router.group(() => {
  /* --------------------------
  | AUTH
  -------------------------- */
  router.group(() => {
    router.post('/signup', '#controllers/auth_controller.register')
    router.post('/login', '#controllers/auth_controller.login')

    router.get('/me', '#controllers/auth_controller.me').use(middleware.auth({ guards: ['api'] }))
    router.post('/logout', '#controllers/auth_controller.logout').use(middleware.auth({ guards: ['api'] }))
    router.delete('/delete-account', '#controllers/auth_controller.deleteAccount').use(middleware.auth({ guards: ['api'] }))

    router.get('/google/redirect', '#controllers/auth_controller.googleRedirect')
    router.get('/google/callback', '#controllers/auth_controller.googleCallback')
  }).prefix('/auth')

  /* --------------------------
  | MODULES
  -------------------------- */
  router.group(() => {
    router.get('/user/:id/stats', '#controllers/modules_controller.userStats').use(middleware.auth({ guards: ['api'] }))
    router.get('/user-modules', '#controllers/modules_controller.userModules')
    router.get('/db-overview', '#controllers/modules_controller.dbOverview').use(middleware.auth({ guards: ['api'] }))
  }).prefix('/modules')

  /* --------------------------
  | CORE APP ROUTES
  -------------------------- */
  router.group(() => {
    // Profile
    router.get('/profile', '#controllers/profile_controller.show').use(middleware.auth({ guards: ['api'] }))
    router.put('/profile', '#controllers/profile_controller.update').use(middleware.auth({ guards: ['api'] }))
    router.put('/profile/avatar', '#controllers/profile_controller.updateAvatar').use(middleware.auth({ guards: ['api'] }))

    // Modules
    router.get('/modules', '#controllers/modules_controller.list')
    router.post('/modules/activate', '#controllers/modules_controller.activate').use(middleware.auth({ guards: ['api'] }))
    router.post('/modules/deactivate', '#controllers/modules_controller.deactivate').use(middleware.auth({ guards: ['api'] }))

    // Connectors
    router.get('/connectors', '#controllers/connectors_controller.list')
    router.get('/connectors/premium', '#controllers/connectors_controller.listPremium')

    router.post('/connectors/activate', '#controllers/connectors_controller.activate').use(middleware.auth({ guards: ['api'] }))
    router.post('/connectors/deactivate', '#controllers/connectors_controller.deactivate').use(middleware.auth({ guards: ['api'] }))
    router.post('/connectors/:key/config', '#controllers/connectors_controller.config').use(middleware.auth({ guards: ['api'] }))

    // Calendar
    router.get('/calendar/events', '#controllers/calendar_controller.list').use(middleware.auth({ guards: ['api'] }))
    router.post('/calendar/events', '#controllers/calendar_controller.create').use(middleware.auth({ guards: ['api'] }))
    router.delete('/calendar/events/:id', '#controllers/calendar_controller.delete').use(middleware.auth({ guards: ['api'] }))
    router.get('/calendar/upcoming', '#controllers/calendar_controller.upcoming').use(middleware.auth({ guards: ['api'] }))

    // Meeting notes
    router.post('/meetings/notes/start', '#controllers/meetings_controller.start').use(middleware.auth({ guards: ['api'] }))
    router.post('/meetings/notes/:id/append', '#controllers/meetings_controller.append').use(middleware.auth({ guards: ['api'] }))
    router.post('/meetings/notes/:id/finish', '#controllers/meetings_controller.finish').use(middleware.auth({ guards: ['api'] }))
    router.post('/meetings/notes/:id/transcribe', '#controllers/meetings_controller.transcribe').use(middleware.auth({ guards: ['api'] }))
    router.get('/meetings/notes', '#controllers/meetings_controller.listUser').use(middleware.auth({ guards: ['api'] }))

    // Projects
    router.get('/projects', '#controllers/projects_controller.list').use(middleware.auth({ guards: ['api'] }))
    router.post('/projects', '#controllers/projects_controller.create').use(middleware.auth({ guards: ['api'] }))
    router.put('/projects/:id', '#controllers/projects_controller.update').use(middleware.auth({ guards: ['api'] }))
    router.delete('/projects/:id', '#controllers/projects_controller.delete').use(middleware.auth({ guards: ['api'] }))

    router.get('/projects/:id/deliveries', '#controllers/deliveries_controller.list').use(middleware.auth({ guards: ['api'] }))
    router.post('/projects/:id/deliveries', '#controllers/deliveries_controller.create').use(middleware.auth({ guards: ['api'] }))
    router.post('/projects/:id/deliveries/:deliveryId/dispatch', '#controllers/deliveries_controller.dispatchOne').use(middleware.auth({ guards: ['api'] }))

    router.get('/deliveries', '#controllers/deliveries_controller.listUser').use(middleware.auth({ guards: ['api'] }))

    // Tasks
    router.get('/tasks', '#controllers/tasks_controller.listUser').use(middleware.auth({ guards: ['api'] }))
    router.post('/tasks/:id/update', '#controllers/tasks_controller.update').use(middleware.auth({ guards: ['api'] }))

    // Newsletter
    router.get('/newsletter/campaigns', '#controllers/newsletter_controller.list').use(middleware.auth({ guards: ['api'] }))
    router.post('/newsletter/campaigns', '#controllers/newsletter_controller.create').use(middleware.auth({ guards: ['api'] }))
    router.post('/newsletter/campaigns/:id/send', '#controllers/newsletter_controller.send').use(middleware.auth({ guards: ['api'] }))

    // Payments / Stripe
    router.post('/payments/checkout', '#controllers/payments_controller.createCheckout').use(middleware.auth({ guards: ['api'] }))
    router.post('/payments/webhook', '#controllers/payments_controller.handleWebhook')
    router.get('/payments/subscription', '#controllers/payments_controller.getCurrentSubscription').use(middleware.auth({ guards: ['api'] }))

    // Finance
    router.get('/finance/summary', '#controllers/finance_controller.summary').use(middleware.auth({ guards: ['api'] }))
    router.get('/finance/journal/today', '#controllers/finance_controller.journalToday').use(middleware.auth({ guards: ['api'] }))
    router.get('/finance/pnl/month', '#controllers/finance_controller.pnlMonth').use(middleware.auth({ guards: ['api'] }))
    router.post('/finance/entries', '#controllers/finance_controller.createEntry').use(middleware.auth({ guards: ['api'] }))

    // SMTP (user config)
    router.post('/smtp/test', '#controllers/connectors_controller.testSmtp').use(middleware.auth({ guards: ['api'] }))

    // Notifications
    router.get('/notifications', '#controllers/notifications_controller.list').use(middleware.auth({ guards: ['api'] }))
    router.post('/notifications/read', '#controllers/notifications_controller.markAsRead').use(middleware.auth({ guards: ['api'] }))

    // Webhooks outbox
    router.post('/webhooks/dispatch', '#controllers/webhooks_controller.dispatch')

    // Uploads
    router.post('/uploads', '#controllers/uploads_controller.upload').use(middleware.auth({ guards: ['api'] }))

    // Donna chat + documents
    router.post('/donna/chat', '#controllers/donna_controller.chat').use(middleware.auth({ guards: ['api'] }))
    router.post('/donna/form/consultation', '#controllers/donna_controller.receiveConsultation')
    router.post('/donna/doc/process', '#controllers/donna_controller.processDocument').use(middleware.auth({ guards: ['api'] }))

    // Realtime
    router.post('/realtime/client-secret', '#controllers/realtime_controller.clientSecret').use(middleware.auth({ guards: ['api'] }))

    // Analytics
    router.get('/analytics/summary', '#controllers/analytics_controller.summary').use(middleware.auth({ guards: ['api'] }))
    router.get('/analytics/stats', '#controllers/analytics_controller.stats').use(middleware.auth({ guards: ['api'] }))
    router.get('/analytics/events', '#controllers/analytics_controller.events').use(middleware.auth({ guards: ['api'] }))

    // Logs
    router.post('/logs/action', '#controllers/logs_controller.action').use(middleware.auth({ guards: ['api'] }))

    // System Settings
    router.get('/system-settings', '#controllers/system_settings_controller.get').use(middleware.auth({ guards: ['api'] }))
    router.post('/system-settings', '#controllers/system_settings_controller.save').use(middleware.auth({ guards: ['api'] }))

    // Gmail
    router.get('/gmail/messages', '#controllers/gmail_controller.messages').use(middleware.auth({ guards: ['api'] }))
  })
}).prefix('/api/v1')

/* ---------------------------------------------------------
|   PUBLIC API (non versionné)
--------------------------------------------------------- */

router.group(() => {
  router.get('/modules', '#controllers/modules_controller.publicModules')
}).prefix('/api/v1/public')

/* ---------------------------------------------------------
|   EXISTING VERSIONNED PUBLIC ENDPOINTS
--------------------------------------------------------- */

router.group(() => {
  router.get('/modules/:key/connectors', '#controllers/connectors_controller.listByModule').use(middleware.auth({ guards: ['api'] }))
  router.post('/modules/:key/activate', '#controllers/modules_controller.activate').use(middleware.auth({ guards: ['api'] }))
  router.post('/modules/:key/deactivate', '#controllers/modules_controller.deactivate').use(middleware.auth({ guards: ['api'] }))

  router.post('/connectors/:key/activate', '#controllers/user_connectors_controller.activate').use(middleware.auth({ guards: ['api'] }))
  router.post('/connectors/:key/deactivate', '#controllers/user_connectors_controller.deactivate').use(middleware.auth({ guards: ['api'] }))

  router.get('/pricing/modules', '#controllers/pricing_controller.listModules')
  router.get('/pricing/connectors', '#controllers/pricing_controller.listConnectors')

  router.get('/connectors/:key/redirect', '#controllers/connectors_controller.redirect')
  router.get('/connectors/:key/callback', '#controllers/connectors_controller.callback')

  router.post('/slack/events', '#controllers/slack_events_controller.events')
}).prefix('/api/v1')

/* ---------------------------------------------------------
|   DEV-ONLY
--------------------------------------------------------- */

if (process.env.NODE_ENV === 'development') {
  router.post('/api/dev/activate-all-modules', async ({ request, response }) => {
    const email = String(request.input('email') || '').trim().toLowerCase()
    if (!email) return response.badRequest({ error: 'email_required' })
    const userRow = await db.from('users').whereRaw('LOWER(email) = ?', [email]).select('id').first()
    if (!userRow?.id) return response.notFound({ error: 'user_not_found' })
    const mods = ['planifi', 'cree', 'publie', 'commercial']
    try {
      await db.raw('UPDATE users SET modules = ? WHERE id = ?', [JSON.stringify(mods), userRow.id])
    } catch {}
    return response.ok({ success: true, email, activated: mods })
  })

  router.post('/api/dev/cleanup-modules', async ({ response }) => {
    const rows: any[] = await db.from('modules').select('id', 'name')
    const canonical = (raw: string): string => {
      const s = String(raw || '').trim().toLowerCase()
      if (s === 'connecte' || s === 'commercial') return 'commercial'
      if (s === 'planifie' || s === 'plannifie' || s === 'planifi') return 'planifi'
      if (s === 'create' || s === 'crée' || s === 'cree') return 'cree'
      if (s === 'publie' || s === 'publish') return 'publie'
      return s
    }
    const groups: Record<string, Array<{ id: number; name: string }>> = {}
    for (const r of rows) {
      const k = canonical(r.name)
      if (!groups[k]) groups[k] = []
      groups[k].push({ id: Number(r.id), name: String(r.name) })
    }
    const changes: any[] = []
    for (const [k, arr] of Object.entries(groups)) {
      if (!arr?.length) continue
      let main = arr.find((x) => x.name.toLowerCase() === k) || arr.reduce((a, b) => (a.id < b.id ? a : b))
      for (const dup of arr) {
        if (dup.id === main.id) continue
        await db.raw('UPDATE user_modules SET module_id = ? WHERE module_id = ?', [main.id, dup.id])
        const del = await db.raw('DELETE FROM modules WHERE id = ? AND NOT EXISTS (SELECT 1 FROM user_modules WHERE module_id = ?)', [dup.id, dup.id])
        changes.push({ type: 'dedup', key: k, removed: dup.id, deleted: !!(del as any)?.rowCount })
      }
      if (main.name.toLowerCase() !== k) {
        await db.raw('UPDATE modules SET name = ? WHERE id = ?', [k, main.id])
        changes.push({ type: 'rename', id: main.id, from: main.name, to: k })
      }
    }
    const after: any[] = await db.from('modules').select('id', 'name').orderBy('name', 'asc')
    return response.ok({ success: true, changes, modules: after })
  })

  router.post('/api/dev/seed-module-connectors', async ({ response }) => {
    const defaults: Record<string, { included: string[]; premium: string[] }> = {
      planifi: { included: ['omoni_calendar','telegram','slack','google_calendar','google_meet','gmail'], premium: ['calendly','smtp'] },
      cree: { included: ['omoni_bucket','telegram','slack','nano_banana','sora2','gmail'], premium: ['suno','elevenlabs','notion','canva','google_drive'] },
      publie: { included: ['omoni_bucket','blotato','telegram','slack'], premium: ['ticketmaster','n8n','spotify'] },
      commercial: { included: ['omoni_crm','telegram','slack','omoni_calendar','hubspot','gmail','google_meet'], premium: ['salesforce','whatsapp_business','twilio','lemonsqueezy','google_calendar'] },
    }
    const results: any[] = []
    for (const [mk, lists] of Object.entries(defaults)) {
      for (const code of lists.included) {
        try {
          await db.raw('INSERT INTO module_connectors (module_key, connector_code, included, type) SELECT ?, ?, true, NULL WHERE NOT EXISTS (SELECT 1 FROM module_connectors WHERE module_key = ? AND connector_code = ?)', [mk, code, mk, code])
          results.push({ module: mk, connector: code, type: 'included' })
        } catch {}
      }
      for (const code of lists.premium) {
        try {
          await db.raw('INSERT INTO module_connectors (module_key, connector_code, included, type) SELECT ?, ?, false, ? WHERE NOT EXISTS (SELECT 1 FROM module_connectors WHERE module_key = ? AND connector_code = ?)', [mk, code, 'premium', mk, code])
          results.push({ module: mk, connector: code, type: 'premium' })
        } catch {}
      }
    }
    const countsRes: any = await db.rawQuery("SELECT module_key AS module, COUNT(*) AS link_count, SUM(CASE WHEN COALESCE(included, (LOWER(type) <> 'premium')) THEN 1 ELSE 0 END) AS included_count, SUM(CASE WHEN LOWER(type) = 'premium' THEN 1 ELSE 0 END) AS premium_count FROM module_connectors GROUP BY module_key ORDER BY module_key")
    return response.ok({ seeded: results.length, results, counts: countsRes?.rows || [] })
  })

  router.post('/api/dev/remove-connector', async ({ request, response }) => {
    const code = String(request.input('code') || '').toLowerCase().trim()
    if (!code) return response.badRequest({ error: 'code_required' })
    try {
      await db.raw('DELETE FROM user_connector_credentials WHERE LOWER(connector_code) = ?', [code])
      await db.raw('DELETE FROM user_connectors WHERE LOWER(connector_code) = ?', [code])
      await db.raw('DELETE FROM module_connectors WHERE LOWER(connector_code) = ?', [code])
      await db.raw('DELETE FROM connectors WHERE LOWER(code) = ?', [code])
      return response.ok({ success: true, removed: code })
    } catch {
      return response.internalServerError({ error: 'remove_failed' })
    }
  })

  router.post('/api/dev/test-upload', async ({ response }) => {
    try {
      const { default: MinioService } = await import('#services/minio_service')
      const svc = new MinioService()
      const buffer = Buffer.from('hello from donna')
      const result = await svc.uploadFile(buffer, 'onboarding/4/uploads', 'test.txt')
      return response.ok({ success: true, path: result.key, url: result.url })
    } catch (err) {
      return response.internalServerError({ error: 'dev_upload_failed' })
    }
  })
}
