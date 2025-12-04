import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

function loadEnv(baseDir) {
  for (const f of ['.env', '.env.production', '.env.production.local']) {
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
  return { host: process.env.PG_HOST || 'localhost', port: Number(process.env.PG_PORT || 5432), user: process.env.PG_USER, password: process.env.PG_PASSWORD, database: process.env.PG_DB_NAME || process.env.PG_DB }
}

async function ensureModule(client, key) {
  const row = await client.query('SELECT id FROM modules WHERE LOWER(name)=LOWER($1) LIMIT 1', [key])
  if (row.rows[0]?.id) return row.rows[0].id
  // Insert minimal columns (name + created_at)
  const ins = await client.query('INSERT INTO modules(name, created_at) VALUES($1, NOW()) RETURNING id', [key])
  return ins.rows[0].id
}

async function main() {
  const baseDir = process.cwd()
  loadEnv(baseDir)
  const client = new Client(cfgFromEnv())
  await client.connect()
  const ures = await client.query("SELECT id,email FROM users WHERE LOWER(email) LIKE '%omoniprestance%' OR LOWER(email) LIKE '%omoniprestanceholding.com%' ORDER BY id LIMIT 1")
  const uid = ures.rows[0]?.id
  if (!uid) throw new Error('No target user')
  const mods = ['planifi','cree','publie','commercial']
  for (const m of mods) {
    const mid = await ensureModule(client, m)
    await client.query('INSERT INTO user_modules(user_id,module_id,is_active,created_at) VALUES($1,$2,true,NOW()) ON CONFLICT DO NOTHING', [uid, mid])
  }
  const r = await client.query('SELECT m.name, um.is_active FROM user_modules um JOIN modules m ON um.module_id=m.id WHERE um.user_id=$1 ORDER BY m.name', [uid])
  console.log('user_modules:', r.rows)
  await client.end()
}

main().catch((e)=>{ console.error('error:', e.message); process.exit(1) })
