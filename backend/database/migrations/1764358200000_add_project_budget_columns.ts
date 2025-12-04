import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddProjectBudgetColumns extends BaseSchema {
  protected tableName = 'projects'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('budget_total', 12, 2).notNullable().defaultTo(0)
      table.string('budget_currency', 8).notNullable().defaultTo('EUR')
      table.text('budget_notes').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('budget_total')
      table.dropColumn('budget_currency')
      table.dropColumn('budget_notes')
    })
  }
}

