import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'system_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('theme').notNullable().defaultTo('light')
      table.string('language').notNullable().defaultTo('fr-FR')
      table.jsonb('notifications_json').notNullable().defaultTo('{}')
      table.jsonb('integrations_json').notNullable().defaultTo('{}')
      table.string('timezone').notNullable().defaultTo('Europe/Paris')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
