import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Pricing extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare type: string

  @column()
  declare key: string

  @column()
  declare price_monthly?: number
}

