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
  return { host: process.env.PG_HOST || '127.0.0.1', port: Number(process.env.PG_PORT || 5432), user: process.env.PG_USER, password: process.env.PG_PASSWORD, database: process.env.PG_DB_NAME || process.env.PG_DB }
}

async function main() {
  const baseDir = process.cwd()
  loadEnv(baseDir)
  const client = new Client(cfgFromEnv())
  await client.connect()
  const ures = await client.query("SELECT id,email,full_name FROM users WHERE LOWER(email) LIKE '%omoniprestance%' OR LOWER(email) LIKE '%omoniprestanceholding.com%' ORDER BY id LIMIT 1")
  const uid = ures.rows[0]?.id
  if (!uid) throw new Error('No target user')
  const fullName = ures.rows[0]?.full_name || 'O\'MONI Prestance'
  await client.query('INSERT INTO profiles(user_id,full_name,company_name,role_title,phone,country,onboarding_completed,created_at) VALUES($1,$2,$3,$4,$5,$6,false,NOW()) ON CONFLICT (user_id) DO NOTHING', [uid, fullName, 'OMONI', 'Owner', '+33123456789', 'FR'])
  const pr = await client.query('SELECT user_id, full_name, company_name FROM profiles WHERE user_id=$1', [uid])
  console.log('profile:', pr.rows[0])
  await client.end()
}

main().catch((e)=>{ console.error('error:', e.message); process.exit(1) })

