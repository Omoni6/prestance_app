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
  const info = await client.query("SELECT current_database() AS db, current_user AS user, inet_server_addr() AS server_addr, inet_client_addr() AS client_addr, version() AS version")
  console.log(JSON.stringify(info.rows[0], null, 2))
  await client.end()
}

main().catch((e) => { console.error('error:', e.message); process.exit(1) })

