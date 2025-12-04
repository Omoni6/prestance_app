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

async function main() {
  const baseDir = new URL('../', import.meta.url).pathname
  loadEnv(baseDir)
  const cfg = cfgFromEnv()
  const client = new Client(cfg)
  await client.connect()
  const q = `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='modules' ORDER BY ordinal_position`
  const res = await client.query(q)
  console.log(res.rows)
  await client.end()
}

main().catch((e) => { console.error('error:', e.message); process.exit(1) })
