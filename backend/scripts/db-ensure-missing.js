import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

function loadEnv(baseDir) {
  const files = ['.env', '.env.production', '.env.production.local']
  for (const f of files) {
    const p = join(baseDir, f)
    if (existsSync(p)) {
      const c = readFileSync(p, 'utf-8')
      for (const line of c.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m) {
          const k = m[1]
          let v = m[2]
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
          process.env[k] = v
        }
      }
    }
  }
}

function cfgFromEnv() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL }
  return {
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DB_NAME || process.env.PG_DB,
  }
}

async function tableExists(client, name) {
  const res = await client.query('SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2', ['public', name])
  return res.rowCount > 0
}

async function ensureTables(client) {
  // auth_access_tokens
  if (!(await tableExists(client, 'auth_access_tokens'))) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_access_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(64) NOT NULL,
        token VARCHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  }

  // align auth_access_tokens.abilities to text (JSON string) for Adonis tokens provider
  try {
    const colRes = await client.query(
      `SELECT data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3`,
      ['public', 'auth_access_tokens', 'abilities']
    )
    if (colRes.rowCount > 0) {
      const currentType = colRes.rows[0]?.data_type
      if (currentType && currentType !== 'text') {
        await client.query(`ALTER TABLE auth_access_tokens ALTER COLUMN abilities TYPE text USING abilities::text`)
      }
    }
  } catch {}

  // newsletter_campaigns
  if (!(await tableExists(client, 'newsletter_campaigns'))) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_campaigns (
        id SERIAL PRIMARY KEY,
        title VARCHAR(256) NOT NULL,
        body_text TEXT NULL,
        body_html TEXT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NULL
      )
    `)
  }

  // tasks
  if (!(await tableExists(client, 'tasks'))) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(512) NOT NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'todo',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NULL
      )
    `)
  }

  // user_connector_credentials
  if (!(await tableExists(client, 'user_connector_credentials'))) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_connector_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        connector_code VARCHAR(128) NOT NULL,
        provider VARCHAR(64) NOT NULL,
        access_token TEXT NULL,
        refresh_token TEXT NULL,
        expires_at TIMESTAMPTZ NULL,
        extra_json JSON NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NULL,
        CONSTRAINT user_connector_credentials_unique UNIQUE (user_id, connector_code)
      )
    `)
  }

  // profiles
  if (!(await tableExists(client, 'profiles'))) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        avatar_url VARCHAR(512) NULL,
        company VARCHAR(256) NULL,
        position VARCHAR(256) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NULL
      )
    `)
  }

  // outbox
  if (!(await tableExists(client, 'outbox'))) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS outbox (
        id SERIAL PRIMARY KEY,
        type VARCHAR(64) NOT NULL,
        target VARCHAR(128) NULL,
        payload_json JSON NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NULL
      )
    `)
  }

  // activity_logs
  if (!(await tableExists(client, 'activity_logs'))) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action_name VARCHAR(128) NOT NULL,
        params_json JSON NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  }

  // projects
  if (!(await tableExists(client, 'projects'))) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(256) NOT NULL,
        description TEXT NULL,
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NULL
      )
    `)
  }

  // project_deliveries
  if (!(await tableExists(client, 'project_deliveries'))) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_deliveries (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        type VARCHAR(32) NOT NULL,
        title VARCHAR(256) NULL,
        url TEXT NULL,
        storage_key VARCHAR(512) NULL,
        channels JSON NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'queued',
        sent_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NULL
      )
    `)
  }

  // finance_entries
  if (!(await tableExists(client, 'finance_entries'))) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS finance_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        project_id INTEGER NULL REFERENCES projects(id) ON DELETE SET NULL,
        source VARCHAR(32) NOT NULL DEFAULT 'manual',
        type VARCHAR(32) NOT NULL DEFAULT 'revenue',
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
        date DATE NOT NULL,
        title VARCHAR(256) NULL,
        external_id VARCHAR(128) NULL,
        file_key VARCHAR(512) NULL,
        metadata JSON NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NULL
      )
    `)
  }

  // system_settings
  if (!(await tableExists(client, 'system_settings'))) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        theme VARCHAR(64) NOT NULL DEFAULT 'light',
        language VARCHAR(16) NOT NULL DEFAULT 'fr-FR',
        notifications_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        integrations_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Paris',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NULL,
        CONSTRAINT system_settings_user_unique UNIQUE (user_id)
      )
    `)
  }

  // meeting_notes
  if (!(await tableExists(client, 'meeting_notes'))) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_notes (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        source VARCHAR(64) NOT NULL,
        title VARCHAR(256) NULL,
        transcript TEXT NULL,
        audio_url TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NULL
      )
    `)
  }
}

async function main() {
  const baseDir = new URL('../', import.meta.url).pathname
  loadEnv(baseDir)
  const cfg = cfgFromEnv()
  const client = new Client(cfg)
  await client.connect()
  await ensureTables(client)
  await client.end()
  console.log('✔ Missing tables ensured')
}

main().catch((e) => {
  console.error('❌ Ensure error:', e.message)
  process.exit(1)
})
