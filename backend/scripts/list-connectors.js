import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

function loadEnv(baseDir) {
  const p = join(baseDir, '.env')
  try {
    const c = readFileSync(p, 'utf-8')
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
}

async function main() {
  const baseDir = process.cwd()
  loadEnv(baseDir)
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL must be defined. No fallback allowed.')
  const client = new Client({ connectionString: url })
  await client.connect()
  const colsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='connectors'")
  const have = new Set(colsRes.rows.map((r) => r.column_name))
  const wanted = ['code','name','icon','is_premium','price']
  const cols = wanted.filter((c) => have.has(c))
  const sql = `SELECT ${cols.join(', ')} FROM connectors ORDER BY code`
  const res = await client.query(sql)
  console.log(JSON.stringify(res.rows, null, 2))
  await client.end()
}

main().catch((e) => { console.error('error:', e.message); process.exit(1) })
