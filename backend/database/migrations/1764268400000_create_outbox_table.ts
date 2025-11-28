import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'outbox'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('type', 64).notNullable()
      table.string('target', 128).nullable()
      table.json('payload_json').notNullable()
      table.string('status', 32).notNullable().defaultTo('pending')
      table.integer('attempts').notNullable().defaultTo(0)
      table.timestamp('next_retry_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

