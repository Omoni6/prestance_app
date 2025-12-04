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
  throw new Error('DATABASE_URL must be defined. No fallback allowed.')
}

async function main() {
  const baseDir = new URL('../', import.meta.url).pathname
  loadEnv(baseDir)
  const cfg = cfgFromEnv()
  const client = new Client(cfg)
  await client.connect()
  const res = await client.query("SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema='public'")
  console.log(res.rows[0].c)
  await client.end()
}

main().catch((e) => { console.error('error:', e.message); process.exit(1) })
