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

const DEFAULT_MODULES = ['planifi', 'cree', 'publie', 'commercial']

async function main() {
  const baseDir = new URL('../', import.meta.url).pathname
  loadEnv(baseDir)
  const cfg = cfgFromEnv()
  const client = new Client(cfg)
  await client.connect()

  const emailArg = process.argv.find((a) => a.startsWith('--email='))?.split('=')[1]
  let user
  if (emailArg) {
    const r = await client.query('SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [emailArg])
    user = r.rows[0]
  } else {
    const r = await client.query('SELECT id, email FROM users ORDER BY id ASC LIMIT 1')
    user = r.rows[0]
  }
  if (!user) throw new Error('User not found')

  const modsRes = await client.query('SELECT id, name FROM modules')
  const nameToId = new Map(modsRes.rows.map((r) => [String(r.name).toLowerCase(), Number(r.id)]))
  const getId = (key) => nameToId.get(key) ?? nameToId.get(key.toLowerCase()) ?? null

  for (const key of DEFAULT_MODULES) {
    const mid = getId(key)
    if (!mid) continue
    await client.query(
      'INSERT INTO user_modules (user_id, module_id, is_active) SELECT $1, $2, TRUE WHERE NOT EXISTS (SELECT 1 FROM user_modules WHERE user_id=$1 AND module_id=$2)',
      [user.id, mid]
    )
  }

  const mc = await client.query('SELECT module_key, connector_code, COALESCE(included, (LOWER(type) <> \'' + 'premium' + '\')) AS included FROM module_connectors')
  const includedCodes = new Set(mc.rows.filter((r) => r.included).map((r) => String(r.connector_code).toLowerCase()))
  for (const code of includedCodes) {
    await client.query(
      'INSERT INTO user_connectors (user_id, connector_code, created_at) SELECT $1, $2, NOW() WHERE NOT EXISTS (SELECT 1 FROM user_connectors WHERE user_id=$1 AND LOWER(connector_code)=LOWER($2))',
      [user.id, code]
    )
  }

  console.log('✔ Preseeded for', user.email)
  await client.end()
}

main().catch((e) => { console.error('❌ Preseed failed:', e.message); process.exit(1) })
