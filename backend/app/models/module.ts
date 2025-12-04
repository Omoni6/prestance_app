import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import UserModule from '#models/user_module'

export default class Module extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description?: string

  @column()
  declare slug?: string

  @column()
  declare icon?: string

  @hasMany(() => UserModule)
  declare userModules: HasMany<typeof UserModule>
}

