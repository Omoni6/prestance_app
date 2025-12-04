import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Use raw SQL to safely convert array/text types to plain text
      this.defer(async (db) => {
        await db.raw(`ALTER TABLE ${this.tableName} ALTER COLUMN abilities TYPE text USING abilities::text`)
      })
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Revert to text[] if needed
      this.defer(async (db) => {
        await db.raw(`ALTER TABLE ${this.tableName} ALTER COLUMN abilities TYPE text[] USING string_to_array(abilities, ',')`)
      })
    })
  }
}
