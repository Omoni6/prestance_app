import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import UserConnector from '#models/user_connector'

export default class Connector extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare is_premium?: boolean

  @column()
  declare icon?: string

  @column()
  declare price?: number

  @hasMany(() => UserConnector)
  declare userConnectors: HasMany<typeof UserConnector>
}
