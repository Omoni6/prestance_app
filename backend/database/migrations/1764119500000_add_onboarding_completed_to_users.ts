import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddOnboardingCompletedToUsers extends BaseSchema {
  protected tableName = 'users'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('onboarding_completed').notNullable().defaultTo(false)
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('onboarding_completed')
    })
  }
}

