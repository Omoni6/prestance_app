import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_connectors'

  public async up() {
    await this.schema.raw(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        connector_id INTEGER NULL REFERENCES connectors(id) ON DELETE SET NULL,
        connector_code VARCHAR(128) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NULL
      )
    `)
    await this.schema.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'user_connectors_user_id_connector_code_unique'
        ) THEN
          ALTER TABLE ${this.tableName}
          ADD CONSTRAINT user_connectors_user_id_connector_code_unique UNIQUE (user_id, connector_code);
        END IF;
      END
      $$;
    `)
  }

  public async down() {
    // Safe: ne pas supprimer la table pour éviter toute perte de données
  }
}
