import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

function parseEnvFile(p) {
  try {
    const c = readFileSync(p, 'utf-8')
    const out = {}
    c.split(/\r?\n/)
      .filter((l) => l && !l.trim().startsWith('#'))
      .forEach((line) => {
        const i = line.indexOf('=')
        if (i > 0) {
          const k = line.slice(0, i).trim()
          let v = line.slice(i + 1).trim()
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
          out[k] = v
        }
      })
    return out
  } catch {
    return {}
  }
}

function cfgFrom(obj) {
  const get = (k) => (obj[k] ?? process.env[k])
  return {
    host: get('PG_HOST') || 'localhost',
    port: Number(get('PG_PORT') || 5432),
    user: get('PG_USER'),
    password: typeof get('PG_PASSWORD') === 'string' ? get('PG_PASSWORD') : String(get('PG_PASSWORD') ?? ''),
    database: get('PG_DB_NAME') || get('PG_DB'),
  }
}

async function main() {
  const baseDir = process.cwd()
  const pathProd = join(baseDir, '.env.production')
  const envProd = parseEnvFile(pathProd)
  const cfg = cfgFrom(envProd)
  console.log('→ Connexion distante (VPS) à Postgres…')
  console.log('Config:', { host: cfg.host, port: cfg.port, user: cfg.user, database: cfg.database })
  const client = new Client(cfg)
  await client.connect()
  const version = await client.query('SHOW server_version')
  const now = await client.query('SELECT NOW() as now')
  const db = await client.query('SELECT current_database() as db')
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")
  console.log('✔ Connecté')
  console.log('server_version:', version.rows[0].server_version)
  console.log('current_database:', db.rows[0].db)
  console.log('server_time:', now.rows[0].now)
  console.log('tables(public):', tables.rows.map((r) => r.table_name))
  await client.end()
}

main().catch((e) => {
  console.log('❌ Erreur connexion distante:', e.message)
  process.exit(1)
})

