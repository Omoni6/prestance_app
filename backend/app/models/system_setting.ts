import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class SystemSetting extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'user_id' })
  declare userId: number

  @column()
  declare theme: string

  @column()
  declare language: string

  @column({ columnName: 'notifications_json' })
  declare notifications: any

  @column({ columnName: 'integrations_json' })
  declare integrations: any

  @column()
  declare timezone: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
