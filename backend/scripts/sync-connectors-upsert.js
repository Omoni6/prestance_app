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
  return {
    host: obj.PG_HOST || 'localhost',
    port: Number(obj.PG_PORT || 5432),
    user: obj.PG_USER,
    password: obj.PG_PASSWORD || '',
    database: obj.PG_DB_NAME || obj.PG_DB,
  }
}

async function main() {
  const baseDir = process.cwd()
  const envLocal = parseEnvFile(join(baseDir, '.env'))
  const cfg = cfgFrom(envLocal)
  const client = new Client(cfg)
  await client.connect()

  const res = await client.query('SELECT code, name, icon, is_premium, price FROM connectors ORDER BY code')
  for (const r of res.rows) {
    const { code, name, icon, is_premium, price } = r
    await client.query(
      `INSERT INTO connectors (code, name, icon, is_premium, price, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         icon = EXCLUDED.icon,
         is_premium = EXCLUDED.is_premium,
         price = EXCLUDED.price,
         updated_at = NOW()`,
      [code, name, icon, !!is_premium, Number(price ?? 0)]
    )
  }
  console.log('Upserted connectors:', res.rowCount)
  await client.end()
}

main().catch((e) => {
  console.log('Erreur:', e.message)
  process.exit(1)
})

