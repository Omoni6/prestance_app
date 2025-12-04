import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'connectors'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('icon', 256).nullable()
      table.decimal('price', 10, 2).notNullable().defaultTo(0)
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('icon')
      table.dropColumn('price')
    })
  }
}
