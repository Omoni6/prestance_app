import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Outbox extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare type: string

  @column()
  declare target?: string

  @column()
  declare payload_json: any

  @column()
  declare status: string

  @column()
  declare attempts: number

  @column()
  declare next_retry_at?: Date
}

