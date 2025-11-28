import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tasks'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('project_id').unsigned().references('id').inTable('projects').onDelete('SET NULL')
      table.timestamp('due_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('project_id')
      table.dropColumn('due_at')
    })
  }
}

