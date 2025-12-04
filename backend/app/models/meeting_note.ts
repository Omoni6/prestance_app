import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class MeetingNote extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare project_id?: number

  @column()
  declare source: string

  @column()
  declare title?: string

  @column()
  declare transcript?: string

  @column()
  declare audio_url?: string
}

