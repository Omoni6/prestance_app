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
  if (obj.DATABASE_URL) return { connectionString: obj.DATABASE_URL }
  throw new Error('DATABASE_URL must be defined. No fallback allowed.')
}

async function main() {
  const baseDir = process.cwd()
  const envLocal = parseEnvFile(join(baseDir, '.env'))
  const cfg = cfgFrom(envLocal)
  const client = new Client(cfg)
  await client.connect()
  const res = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")
  console.log('tables:', res.rows.map((r) => r.tablename))
  await client.end()
}

main().catch((e) => {
  console.log('error:', e.message)
  process.exit(1)
})
