import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

async function ensure(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS connectors (
    id SERIAL PRIMARY KEY,
    code VARCHAR(128) NOT NULL UNIQUE,
    name VARCHAR(256) NOT NULL,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NULL
  )`)
  await client.query(`CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(256) NOT NULL,
    description TEXT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NULL
  )`)
  await client.query(`CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(512) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'todo',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NULL
  )`)
}

async function main() {
  const baseDir = process.cwd()
  try {
    const c = readFileSync(join(baseDir, '.env'), 'utf-8')
    for (const line of c.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) {
        const k = m[1]
        let v = m[2]
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
        if (!process.env[k]) process.env[k] = v
      }
    }
  } catch {}
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be defined. No fallback allowed.')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await ensure(client)
  const res = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")
  console.log('tables:', res.rows.map((r) => r.tablename))
  await client.end()
}

main().catch((e) => {
  console.log('error:', e.message)
  process.exit(1)
})
