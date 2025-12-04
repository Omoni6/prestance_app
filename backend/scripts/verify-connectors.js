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
  const list = await client.query('SELECT code, name FROM connectors ORDER BY code')
  const check = await client.query("SELECT code FROM connectors WHERE code IN ('data','meteo','omoni_voice') ORDER BY code")
  console.log('Total connectors:', list.rowCount)
  console.log('First 10:', list.rows.slice(0, 10))
  console.log('Exists (data, meteo, omoni_voice):', check.rows.map((r)=>r.code))
  await client.end()
}

main().catch((e) => { console.error('error:', e.message); process.exit(1) })

