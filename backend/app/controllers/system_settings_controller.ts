import type { HttpContext } from '@adonisjs/core/http'
import SystemSetting from '#models/system_setting'

export default class SystemSettingsController {
  public async get({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const row = await SystemSetting.query().where('user_id', user.id).first()
      if (!row) {
        return response.ok({
          user_id: String(user.id),
          theme: 'light',
          language: 'fr-FR',
          notifications: { email: true, telegram: false, sms: false },
          integrations: {},
          timezone: 'Europe/Paris',
        })
      }
      return response.ok({
        id: String(row.id),
        user_id: String(row.userId),
        theme: String(row.theme || 'light'),
        language: String(row.language || 'fr-FR'),
        notifications: row.notifications || {},
        integrations: row.integrations || {},
        timezone: String(row.timezone || 'Europe/Paris'),
        updated_at: row.updatedAt ? row.updatedAt.toISO() : undefined,
      })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }

  public async save({ auth, request, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const updates = request.input('updates') || {}
      const existing = await SystemSetting.query().where('user_id', user.id).first()
      if (!existing) {
        const created = await SystemSetting.create({
          userId: user.id,
          theme: String(updates.theme || 'light'),
          language: String(updates.language || 'fr-FR'),
          notifications: updates.notifications || {},
          integrations: updates.integrations || {},
          timezone: String(updates.timezone || 'Europe/Paris'),
        })
        return response.ok({ success: true, id: created.id })
      }
      existing.theme = String(updates.theme || existing.theme || 'light')
      existing.language = String(updates.language || existing.language || 'fr-FR')
      existing.notifications = typeof updates.notifications !== 'undefined' ? updates.notifications : existing.notifications || {}
      existing.integrations = typeof updates.integrations !== 'undefined' ? updates.integrations : existing.integrations || {}
      existing.timezone = String(updates.timezone || existing.timezone || 'Europe/Paris')
      await existing.save()
      return response.ok({ success: true })
    } catch {
      return response.unauthorized({ error: 'unauthenticated' })
    }
  }
}
