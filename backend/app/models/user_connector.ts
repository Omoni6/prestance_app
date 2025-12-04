import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Connector from '#models/connector'

export default class UserConnector extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare user_id: number

  @column()
  declare connector_id?: number

  @column()
  declare connector_code: string

  @column()
  declare created_at?: Date

  @column()
  declare updated_at?: Date

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Connector)
  declare connector: BelongsTo<typeof Connector>
}

