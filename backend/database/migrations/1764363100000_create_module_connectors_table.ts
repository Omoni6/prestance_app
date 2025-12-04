import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'module_connectors'

  public async up() {
    await this.schema.raw(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id SERIAL PRIMARY KEY,
        module_key VARCHAR(128) NOT NULL,
        connector_code VARCHAR(128) NOT NULL,
        included BOOLEAN NOT NULL DEFAULT TRUE,
        type VARCHAR(64) NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NULL
      )
    `)
    await this.schema.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'module_connectors_module_key_connector_code_unique'
        ) THEN
          ALTER TABLE ${this.tableName}
          ADD CONSTRAINT module_connectors_module_key_connector_code_unique UNIQUE (module_key, connector_code);
        END IF;
      END
      $$;
    `)
  }

  public async down() {
    // Safe: ne pas supprimer la table
  }
}
