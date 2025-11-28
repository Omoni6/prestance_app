import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'project_deliveries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('project_id').unsigned().references('id').inTable('projects').onDelete('CASCADE')
      table.string('type', 32).notNullable() // image, video, branding, audio, document, newsletter
      table.string('title', 256).nullable()
      table.text('url').nullable()
      table.string('storage_key', 512).nullable()
      table.json('channels').nullable() // e.g., ["email","slack","telegram"]
      table.string('status', 32).notNullable().defaultTo('queued') // queued|sent|failed
      table.timestamp('sent_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

