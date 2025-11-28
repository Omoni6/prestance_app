import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'meeting_notes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('project_id').unsigned().references('id').inTable('projects').onDelete('SET NULL')
      table.string('source', 64).notNullable() // meet|calendly|webrtc|other
      table.string('title', 256).nullable()
      table.text('transcript').nullable()
      table.text('audio_url').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

