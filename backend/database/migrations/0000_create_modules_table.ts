import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateModules extends BaseSchema {
  protected tableName = 'modules'

  public async up() {
    await this.schema.raw(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(256) NOT NULL,
        description TEXT NULL,
        slug VARCHAR(128) NULL,
        icon VARCHAR(256) NULL,
        connectors_included JSONB NULL,
        connectors_premium JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NULL
      )
    `)
  }

  public async down() {
  }
}

