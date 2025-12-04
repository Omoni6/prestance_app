import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateFinanceEntriesTable extends BaseSchema {
  protected tableName = 'finance_entries'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('project_id').unsigned().nullable().references('id').inTable('projects').onDelete('SET NULL')
      table.string('source', 32).notNullable().defaultTo('manual') // manual, stripe, lemonsqueezy
      table.string('type', 32).notNullable().defaultTo('revenue') // revenue, expense, invoice
      table.decimal('amount', 12, 2).notNullable().defaultTo(0)
      table.string('currency', 8).notNullable().defaultTo('EUR')
      table.date('date').notNullable()
      table.string('title', 256).nullable()
      table.string('external_id', 128).nullable()
      table.string('file_key', 512).nullable()
      table.json('metadata').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}

