import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_connector_credentials'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('connector_code', 128).notNullable()
      table.string('provider', 64).notNullable()
      table.text('access_token').nullable()
      table.text('refresh_token').nullable()
      table.timestamp('expires_at').nullable()
      table.json('extra_json').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['user_id', 'connector_code'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

