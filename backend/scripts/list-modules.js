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

  const colsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='modules'")
  const have = new Set(colsRes.rows.map((r) => r.column_name))
  const possibles = ['id','slug','key','name','description','enabled','is_active','active','price','price_monthly','created_at','updated_at']
  const cols = possibles.filter((c) => have.has(c))
  const orderCol = have.has('slug') ? 'slug' : (have.has('key') ? 'key' : 'name')
  const sql = `SELECT ${cols.join(', ')} FROM modules ORDER BY ${orderCol}` 
  const res = await client.query(sql)
  console.log('columns:', cols.join(', '))
  console.log('count:', res.rowCount)
  for (const r of res.rows) {
    const id = r.id ?? ''
    const name = r.name ?? ''
    const active = (r.active ?? r.enabled ?? r.is_active ?? null)
    const created = r.created_at ?? ''
    console.log(`- ${id} | ${name} | active=${active} | created_at=${created}`)
  }

  await client.end()
}

main().catch((e) => { console.error('error:', e.message); process.exit(1) })
